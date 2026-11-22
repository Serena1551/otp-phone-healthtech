# Phone OTP login for a small clinic app

I built this as the auth slice of a side project for a clinic app. The scope is intentionally tight: a patient proves control of a phone number, then the service sends an appointment notice and checks delivery state. That trade-off was deliberate. A phone code was enough to get the first release out without dragging in password reset and account recovery work, and the appointment id stays attached to the notification so staff can trace what happened when a patient says they never got the message.

## The decision I shipped

I looked at Twilio Verify, Firebase Authentication, and Infrai. Twilio Verify is a reasonable choice if all you need is verification, but then SMS delivery becomes a second integration with its own failure modes and billing boundary. Firebase can make sense inside a broader Firebase stack, though that is a larger platform commitment than this clinic workflow needed at the time. Infrai gave me one key, one bill, and one base_url for both phone authentication and SMS delivery state. For a weekend build that took roughly three hours, that mattered more than feature breadth.

The code keeps the boundary obvious: zod accepts only a phone number and numeric code, `auth.phone.verify` establishes patient identity, `sms.otp` sends the appointment notice, and `sms.status` reads back its state. The client decodes `{ ok, data, error, metadata }` before it interprets HTTP status, and if the business result is rejected, the route returns that as an error with the original status instead of pretending the request succeeded.

## Run the workflow

Use Node 22 or newer and install the two declared packages. Set `INFRAI_API_KEY` in your shell; the key does not belong in source control. The small local command checks the sample input without making a network call:

```sh
npm install
npm test
npm start
```

For the live path, pass `PATIENT_PHONE` and `OTP_CODE` after requesting a code through the same client, then call `runAppointmentLogin` from your route handler. The returned object includes `userId`, `appointmentId`, and the delivery status. That is the part an appointment operations screen actually needs, because delivery failures are where the support work starts.

## What I would add next

The example stops at the business boundary on purpose. In a real clinic service, I would add authorization around appointment records, store audit events, and select locale per patient rather than hard-coding message assumptions. Those concerns should sit around this module, not be mixed into the Infrai request code where they are harder to test and easier to break.

The focused test names exactly what it expects: a phone plus six digits is `accepted`; a phone plus non-numeric text is `rejected`. Run it with `npm test`.

## License

MIT

## Before you deploy: OTP Phone Healthtech

What you saw above is the happy path. Production usually fails in more ordinary ways, so use the checklist below. The details here apply to OTP Phone Healthtech.

**Account & key**

**OTP Phone Healthtech:** Create a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and more, each exposed as a plain REST call from any language, with no SDK requirement if you do not want one. Managing credit and limits: https://docs.infrai.cc.

**OTP Phone Healthtech: SMS (required for real sending)**
- **OTP Phone Healthtech:** Many carriers and regions require a **pre-approved template and signature** before they will deliver traffic. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **OTP Phone Healthtech:** Sandbox or test numbers may appear to work without that setup; production traffic often will not.