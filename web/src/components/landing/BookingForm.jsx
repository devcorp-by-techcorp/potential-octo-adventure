import { useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import Dialog from "./Dialog";
import { collections, studioEmail } from "@/data/studio";
import { api } from "@/lib/api";

export default function BookingForm({
  initial = {},
  sessionId,
  onClose,
  onSubmitted,
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    event_type: "Wedding",
    preferred_date: "",
    collection: "signature",
    venue: "",
    message: "",
    ...initial,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const requestId = useRef(crypto.randomUUID());
  const dateParts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const datePart = (type) => dateParts.find((part) => part.type === type).value;
  const today = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const update = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/bookings", {
        ...form,
        consent: true,
        request_id: requestId.current,
        session_id: sessionId || null,
      });
      setReceipt(result);
      onSubmitted?.(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      className="reserve-dialog"
      title={receipt ? "Your enquiry is received" : "Begin your enquiry"}
      onClose={onClose}
      dismissible={!busy}
    >
      {receipt ? (
        <div className="booking-receipt" role="status">
          <Check className="receipt-icon" size={32} />
          <p>
            Your tentative request is with the studio for review. Your preferred
            date is pending confirmation.
          </p>
          <p className="form-note">
            Reference: {receipt.reference}. Please keep this for any follow-up.
            This is an enquiry, and your date has not been reserved.
          </p>
          <button className="studio-button primary" onClick={onClose}>
            Back to the studio
          </button>
        </div>
      ) : (
        <>
          <p className="dialog-intro">
            A little about you, a little about your day. The studio will review
            availability and help you find the right collection.
          </p>
          <form onSubmit={submit} className="booking-form">
            <div className="form-grid">
              <label>
                Your name
                <input
                  required
                  name="name"
                  autoComplete="name"
                  maxLength={120}
                  value={form.name}
                  onChange={update}
                />
              </label>
              <label>
                Email address
                <input
                  required
                  type="email"
                  name="email"
                  autoComplete="email"
                  maxLength={254}
                  value={form.email}
                  onChange={update}
                />
              </label>
              <label>
                Phone <span>(optional)</span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  maxLength={40}
                  value={form.phone}
                  onChange={update}
                />
              </label>
              <label>
                Preferred date
                <input
                  required
                  type="date"
                  name="preferred_date"
                  min={today}
                  value={form.preferred_date}
                  onChange={update}
                />
              </label>
              <label>
                Session type
                <select
                  name="event_type"
                  value={form.event_type}
                  onChange={update}
                >
                  {[
                    "Wedding",
                    "Editorial",
                    "Family",
                    "Portrait",
                    "Brand / Commercial",
                    "Other",
                  ].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Collection
                <select
                  name="collection"
                  value={form.collection}
                  onChange={update}
                >
                  {collections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                  <option value="undecided">Help me choose</option>
                </select>
              </label>
              <label className="full-width">
                Venue or location <span>(optional)</span>
                <input
                  name="venue"
                  maxLength={250}
                  value={form.venue}
                  onChange={update}
                />
              </label>
              <label className="full-width">
                Tell us about your plans <span>(optional)</span>
                <textarea
                  name="message"
                  maxLength={2000}
                  rows={3}
                  value={form.message}
                  onChange={update}
                />
              </label>
            </div>
            <label className="consent">
              <input required type="checkbox" />I agree that the studio may
              store these details and contact me about this enquiry.
            </label>
            <p className="form-note">
              Sending an enquiry does not reserve a date or confirm a booking.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error} You can also email{" "}
                <a href={`mailto:${studioEmail}`}>{studioEmail}</a>.
              </p>
            )}
            <button
              className="studio-button primary"
              type="submit"
              disabled={busy}
            >
              {busy ? "Sending your enquiry…" : "Send enquiry"}
              <ArrowRight size={15} />
            </button>
          </form>
        </>
      )}
    </Dialog>
  );
}
