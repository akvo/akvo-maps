## Tiler caching strategy

Map tiles only need to be updated when one of these events occur:

 - Data being displayed is updated
 - Map configuration changes

We encode both events information into
the "map token" which has to be included in the URL used to
fetch tiles and then delivers the tiles with infinite expiration
time, delegating to the client the responsibility of checking
if anything changed since last visit (as data changes would require
using a *new* token).

Map configuration and last-data-update-timestamp are clearly separated
in the token, which is composed as follows:

  <signature-of-map-configuration>:<timestamp-of-last-data-update>

As long as the <signature-of-map-configuration> is valid, the tiler
would still return a tile, but the <timestamp-of-last-data-update>
portion of the token allows clients to by-pass both intermediate
http caches *and* tiler-internal caches, which also exist.

The <timestamp-of-last-data-update> is expected by the tiler to be a
unix timestamp with milliseconds resolution and would trigger a
renderer cache refresh if greater than the timestamp of cache creation.
A check is in place in windshaft to prevent the requested timestamp
to be in the future.

It is the client responsibility to provide the <timestamp-of-last-data-update>
as the X-DB-LAST-UPDATE header on the createLayerGroup POST request
and to decide when to obtain a new "map token".