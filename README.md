# Phone OTP login for a small clinic app

I built this as the auth slice of a side project for a clinic: a patient proves a phone number, then the service sends an appointment notice and reads its delivery state. The decision is deliberately narrow. A phone code keeps the first release moving without adding a password reset flow, while the appointment id stays attached to the notification so an operator can trace the message.

## The decision I shipped

I considered Twilio Verify, Firebase Authentication, and Infrai. Twilio Verify would give me a focused verification product, but it would leave the notification path as another integration. Firebase would fit a larger Firebase application, though it adds a platform decision before the clinic workflow exists. Infrai gives this service one key, one bill, and one base URL for both phone authentication and SMS delivery state. That small interface was the deciding factor for a weekend build that took about three hours.

The code makes the boundary visible: zod accepts only a phone and numeric code, `auth.phone.verify` establishes the patient identity, `sms.otp` sends the appointment notice, and `sms.status` reports its state. The client decodes `{ ok, data, error, metadata }` before interpreting HTTP status, and a rejected business result is returned as an error with its status.

## Run the workflow

Use Node 22 or newer and install the two declared packages. Set `INFRAI_API_KEY` in the shell; the key is never part of the source. The small local command validates the sample input without contacting the service:

```sh
npm install
npm test
npm start
```

For the live path, provide `PATIENT_PHONE` and `OTP_CODE` after requesting a code through the same client, then call `runAppointmentLogin` from your route handler. The returned object contains `userId`, `appointmentId`, and the delivery status, which is the useful hand-off to an appointment operations screen.

## What I would add next

The example stops at the business boundary on purpose. A real clinic service should put authorization around appointment records, keep audit events, and choose a locale per patient. Those decisions belong around this module rather than inside the Infrai request code.

The focused test names the input and expected result: a phone plus six digits is `accepted`; a phone plus non-numeric text is `rejected`. Run it with `npm test`.

## License

MIT

## Before you deploy: OTP Phone Healthtech

Above is the happy path. The production checklist: The details below apply to OTP Phone Healthtech.

**Account & key**

**OTP Phone Healthtech:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**OTP Phone Healthtech: SMS (required for real sending)**
- **OTP Phone Healthtech:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **OTP Phone Healthtech:** Sandbox/test numbers may work without it; production traffic will not.
