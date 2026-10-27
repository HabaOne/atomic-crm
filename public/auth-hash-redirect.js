// Invite and password recovery links from Supabase land on the Site URL
// (the app root) with the session in the hash, e.g.
// "#access_token=...&refresh_token=...&type=invite". The hash router would
// read that as a route and the Supabase client would sign the user in, so
// the set-password page never shows. Send these links to the auth callback
// route, like public/auth-callback.html does, before the app bundle loads.
(function () {
  var hash = window.location.hash || "";
  if (hash.indexOf("#access_token=") !== 0) return;

  var params = new URLSearchParams(hash.substring(1));
  var accessToken = params.get("access_token");
  var refreshToken = params.get("refresh_token");
  var type = params.get("type");
  if (!accessToken || !refreshToken) return;
  if (type !== "invite" && type !== "recovery") return;

  window.location.replace(
    "./#/auth-callback?access_token=" +
      encodeURIComponent(accessToken) +
      "&refresh_token=" +
      encodeURIComponent(refreshToken) +
      "&type=" +
      type,
  );
})();
