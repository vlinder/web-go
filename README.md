# web-go

This web app tries to control [tenuki.js](https://github.com/aprescott/tenuki)
using **_most_** streams.

One problem with this approach is that Tenuki is not very suited to be on a
single page application. It would rather be used only once per game instance and
then very much would like a page refresh.

This implementation kind of works but if you create too many games the page will
become really sluggish and unresponsive.

Mostly this was a way to learn the new version of most.js (@most/core) and a bit
of typescript.
