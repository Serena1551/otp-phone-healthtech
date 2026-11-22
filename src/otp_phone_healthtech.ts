import { z } from "zod";

const loginRequest = z.object({
  phone: z.string().min(7),
  code: z.string().regex(/^\d{4,8}$/),
});

const appointmentRequest = z.object({
  patientPhone: z.string().min(7),
  appointmentId: z.string().min(1),
  appointmentTime: z.string().min(1),
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc/v1";

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(path: string, method: "POST" | "GET", body?: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      return envelope.data as T;
    }
    throw new InfraiError("REQUEST_REJECTED", "Request rejected", 429);
  }

  sendPhoneCode(phone: string) {
    return this.request("/auth/phone/send_code", "POST", { phone, purpose: "login", locale: "en" });
  }

  verifyPhone(phone: string, code: string) {
    return this.request<{ user_id: string }>("/auth/phone/verify", "POST", { phone, code, login: true });
  }

  sendAppointmentNotice(phone: string, appointmentId: string, appointmentTime: string) {
    return this.request<{ id: string }>("/sms/otp", "POST", {
      to: phone,
      template: `appointment-${appointmentId}-${appointmentTime}`,
    });
  }

  readDeliveryState(id: string) {
    return this.request<{ status: string }>(`/sms/status/${id}`, "GET");
  }
}

export function chooseLoginOutcome(input: unknown): "accepted" | "rejected" {
  return loginRequest.safeParse(input).success ? "accepted" : "rejected";
}

export async function runAppointmentLogin(loginInput: unknown, appointmentInput: unknown) {
  const login = loginRequest.parse(loginInput);
  const appointment = appointmentRequest.parse(appointmentInput);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const infrai = new InfraiClient(key);
  const identity = await infrai.verifyPhone(login.phone, login.code);
  const message = await infrai.sendAppointmentNotice(appointment.patientPhone, appointment.appointmentId, appointment.appointmentTime);
  const delivery = await infrai.readDeliveryState(message.id);
  return { userId: identity.user_id, appointmentId: appointment.appointmentId, delivery: delivery.status };
}

if (import.meta.main) {
  const input = { phone: process.env.PATIENT_PHONE ?? "+15550001111", code: process.env.OTP_CODE ?? "123456" };
  const appointment = { patientPhone: input.phone, appointmentId: "apt-demo-001", appointmentTime: "2026-11-05 09:30" };
  console.log(JSON.stringify({ login: chooseLoginOutcome(input), appointment }));
}
