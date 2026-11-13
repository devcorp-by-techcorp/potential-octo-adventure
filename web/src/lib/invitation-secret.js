// Capture and scrub before React renders or any application request runs.
// The bearer secret lives only in module/component memory and POST bodies.
let captured = "";
export function captureInvitation() {
  if (window.location.pathname === "/client/accept" && window.location.hash) {
    captured = window.location.hash.slice(1);
    window.history.replaceState(window.history.state, "", "/client/accept");
    window.dispatchEvent(new Event("client-invitation-changed"));
  }
  return captured;
}
export function clearInvitation() { captured = ""; }
captureInvitation();
window.addEventListener("hashchange", captureInvitation);
