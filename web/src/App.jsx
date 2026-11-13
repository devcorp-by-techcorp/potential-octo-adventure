import { BrowserRouter, Route, Routes } from "react-router-dom";

import Landing from "@/pages/Landing";
import PortalEntry from "@/pages/PortalEntry";
import Studio from "@/pages/Studio";
import Client from "@/pages/Client";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/client" element={<Client />} />
        <Route path="/client/accept" element={<Client key="accept" />} />
        <Route path="/client/home" element={<Client />} />
        <Route path="/client/enquiries/:enquiryId" element={<Client />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/studio/contacts" element={<Studio />} />
        <Route path="/studio/content" element={<Studio />} />
        <Route path="/studio/operations" element={<Studio />} />
        <Route path="/studio/booking-resources" element={<Studio />} />
        <Route path="/studio/booking-drafts" element={<Studio />} />
        <Route path="/studio/reporting" element={<Studio />} />
        <Route path="/studio/home" element={<Studio />} />
        <Route path="/studio/enquiries" element={<Studio />} />
        <Route path="/studio/enquiries/:enquiryId" element={<Studio />} />
        <Route path="/studio/bookings" element={<Studio />} />
        <Route path="/studio/bookings/:bookingId" element={<Studio />} />
        <Route path="*" element={<PortalEntry />} />
      </Routes>
    </BrowserRouter>
  );
}
