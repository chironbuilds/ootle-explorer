// Forwards testnet-explorer.tari.mw to the nginx site on the origin server.
const ORIGIN = "testnet-explorer.172-245-5-169.sslip.io";

export default {
  fetch(request) {
    const url = new URL(request.url);
    url.hostname = ORIGIN;
    return fetch(url, new Request(request, { redirect: "manual" }));
  },
};
