import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

// Fix default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// ── Custom Icons (created once, outside component) ────────────────────────────
const pickupIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: markerShadow,
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const destinationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: markerShadow,
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const userLocationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: markerShadow,
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const carIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png',
    iconSize: [45, 45], iconAnchor: [22, 22], popupAnchor: [0, -22],
});

const passengerIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/709/709722.png',
    iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20]
});

const yellowCarIcon = new L.DivIcon({
    html: `<div style="width:54px;height:54px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 6px rgba(184,134,11,0.7))">
        <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none">
            <path d="M4 11C4 11 4 7 5 6C6 5 18 5 19 6C20 7 20 11 20 11H4Z" fill="#B8860B" fill-opacity="0.9" stroke="#8B4513" stroke-width="0.5"/>
            <path d="M3 11H21C22 11 22.5 11.5 22.5 12.5V16.5C22.5 17.5 21.5 18 20.5 18H3.5C2.5 18 1.5 17.5 1.5 16.5V12.5C1.5 11.5 2 11 3 11Z" fill="#B8860B" stroke="#8B4513" stroke-width="0.8"/>
            <path d="M6 10L7 6.5H17L18 10H6Z" fill="#1E293B" stroke="#334155" stroke-width="0.5"/>
            <path d="M12 6.5V10" stroke="#334155" stroke-width="0.3"/>
            <rect x="2" y="12" width="2" height="1.5" rx="0.5" fill="#FEF08A" stroke="#EAB308" stroke-width="0.3"/>
            <rect x="20" y="12" width="2" height="1.5" rx="0.5" fill="#FEF08A" stroke="#EAB308" stroke-width="0.3"/>
            <circle cx="6" cy="18" r="2.5" fill="#1F2937" stroke="#000" stroke-width="1"/>
            <circle cx="18" cy="18" r="2.5" fill="#1F2937" stroke="#000" stroke-width="1"/>
            <circle cx="6" cy="18" r="1" fill="#4B5563"/>
            <circle cx="18" cy="18" r="1" fill="#4B5563"/>
        </svg>
    </div>`,
    iconSize: [54, 54],
    iconAnchor: [27, 27],
    popupAnchor: [0, -30],
    className: ''
});

// ── Sim Car Marker — dead-reckoning (velocity extrapolation) ─────────────────
// Updates at 60fps via requestAnimationFrame. Uses velocity extrapolation so
// the car continues moving smoothly between socket updates — no pauses/jumps.
// Same technique used by Uber, game engines (Source/Unreal network movement).
const SimCarMarker = ({ positionRef, active }) => {
    const map = useMap();
    const markerRef = useRef(null);
    const rafRef = useRef(null);

    useEffect(() => {
        if (!active) {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (markerRef.current) {
                map.removeLayer(markerRef.current);
                markerRef.current = null;
            }
            return;
        }

        markerRef.current = L.marker([0, 0], { icon: yellowCarIcon, zIndexOffset: 1000 }).addTo(map);
        markerRef.current.setOpacity(0);

        // Smooth interpolation state (plain JS — no React)
        let fromLat = 0, fromLng = 0;  // interpolation start (current marker position)
        let toLat = 0, toLng = 0;      // interpolation target (latest socket position)
        let interpStart = 0;
        let lastSeenRef = null;
        // Duration slightly longer than emit interval (60ms) to ensure overlap = no gaps
        const INTERP_MS = 90;
        const lerp = (a, b, t) => a + (b - a) * t;
        const easeOut = (t) => 1 - (1 - t) * (1 - t);

        const tick = (now) => {
            if (!markerRef.current) { rafRef.current = requestAnimationFrame(tick); return; }
            const pos = positionRef.current;

            // New position arrived from socket — update interpolation targets
            // Guard against null (set when simulation ends via handleSystemReset)
            if (pos && pos !== lastSeenRef) {
                const cur = markerRef.current.getLatLng();
                // Start from current marker position (mid-interpolation) for seamless transition
                fromLat = cur.lat || pos.lat;
                fromLng = cur.lng || pos.lng;
                toLat = pos.lat;
                toLng = pos.lng;
                interpStart = now;
                lastSeenRef = pos;
                markerRef.current.setOpacity(1);
            }

            // Smoothly interpolate toward target — car never stops or snaps
            if (lastSeenRef !== null) {
                const t = easeOut(Math.min(1, (now - interpStart) / INTERP_MS));
                markerRef.current.setLatLng([lerp(fromLat, toLat, t), lerp(fromLng, toLng, t)]);
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (markerRef.current) {
                map.removeLayer(markerRef.current);
                markerRef.current = null;
            }
        };
    }, [map, active, positionRef]);

    return null;
};

// ── Routing Engine ────────────────────────────────────────────────────────────
const RoutingEngine = ({ pickup, destination, onRouteFound }) => {
    const map = useMap();
    const routingControlRef = useRef(null);

    const cleanup = useCallback(() => {
        if (routingControlRef.current) {
            try {
                // Remove ALL event listeners so a pending async OSRM response
                // can't draw the route AFTER we've cleaned up
                routingControlRef.current.off();
            } catch (e) {}
            try {
                // Directly remove the internal polyline layer if it exists
                if (routingControlRef.current._line && map.hasLayer(routingControlRef.current._line)) {
                    map.removeLayer(routingControlRef.current._line);
                }
            } catch (e) {}
            try { map.removeControl(routingControlRef.current); } catch (e) {}
            routingControlRef.current = null;
        }
        // Remove any lingering DOM nodes
        document.querySelectorAll('.leaflet-routing-container').forEach(el => el.remove());
    }, [map]);

    useEffect(() => {
        cleanup();

        if (pickup?.lat && destination?.lat) {
            const control = L.Routing.control({
                waypoints: [L.latLng(pickup.lat, pickup.lng), L.latLng(destination.lat, destination.lng)],
                routeWhileDragging: false,
                addWaypoints: false,
                draggableWaypoints: false,
                fitSelectedRoutes: false,
                show: false,
                autoRoute: true,
                lineOptions: { styles: [{ color: '#1E6BB5', weight: 5, opacity: 0.85 }] },
                router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
                createMarker: () => null
            })
                .on('routesfound', (e) => {
                    const route = e.routes[0];
                    if (onRouteFound) {
                        onRouteFound({ distance: route.summary.totalDistance / 1000, time: route.summary.totalTime });
                    }
                })
                .on('routingerror', () => { if (onRouteFound) onRouteFound(null); })
                .addTo(map);

            routingControlRef.current = control;
        } else {
            if (onRouteFound) onRouteFound(null);
        }

        return () => cleanup();
    }, [pickup, destination, map, onRouteFound, cleanup]);

    return null;
};

// ── Simulation Route (orange dashed) ─────────────────────────────────────────
const SimulationRoute = ({ from, to }) => {
    const map = useMap();
    const routingControlRef = useRef(null);

    const cleanup = useCallback(() => {
        if (routingControlRef.current) {
            try { routingControlRef.current.off(); } catch (e) {}
            try {
                if (routingControlRef.current._line && map.hasLayer(routingControlRef.current._line)) {
                    map.removeLayer(routingControlRef.current._line);
                }
            } catch (e) {}
            try { map.removeControl(routingControlRef.current); } catch (e) {}
            routingControlRef.current = null;
        }
        document.querySelectorAll('.sim-routing-container').forEach(el => el.remove());
    }, [map]);

    useEffect(() => {
        cleanup();

        if (from?.lat && to?.lat) {
            const control = L.Routing.control({
                waypoints: [L.latLng(from.lat, from.lng), L.latLng(to.lat, to.lng)],
                routeWhileDragging: false, addWaypoints: false, draggableWaypoints: false,
                fitSelectedRoutes: false, show: false, autoRoute: true,
                lineOptions: { styles: [{ color: '#F97316', weight: 5, opacity: 0.9, dashArray: '8, 6' }] },
                router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
                createMarker: () => null
            }).addTo(map);

            document.querySelectorAll('.leaflet-routing-container').forEach(el => el.classList.add('sim-routing-container'));
            routingControlRef.current = control;
        }

        return () => cleanup();
    }, [from, to, map, cleanup]);

    return null;
};

// ── Co-location offset (spiral / "spiderfy") ─────────────────────────────────
// When multiple markers share the exact same coordinates (e.g. testing on one device),
// they stack invisibly. This function spreads them in a golden-angle spiral so every
// marker is individually visible — same technique used by Leaflet.markercluster spiderfy.
const OFFSET_RADIUS_DEG = 0.00022; // ~24 metres per ring step
const GOLDEN_ANGLE = 2.39996; // ≈ 137.5° in radians — maximally even angular spread

const spreadColocated = (items, getLatLng) => {
    // Group by rounded position key
    const groups = new Map();
    items.forEach((item, idx) => {
        const loc = getLatLng(item);
        if (!loc) return;
        const key = `${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`; // ~11m resolution
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ item, idx });
    });

    const result = new Array(items.length);
    groups.forEach((members) => {
        members.forEach(({ item, idx }, slot) => {
            const loc = getLatLng(item);
            if (!loc) { result[idx] = { ...item, _loc: null }; return; }

            if (slot === 0 || members.length === 1) {
                // First / only marker — stays at original position
                result[idx] = { ...item, _loc: loc };
            } else {
                // Offset using golden-angle spiral so markers fan out evenly
                const ring = Math.ceil(slot / 8);
                const radius = OFFSET_RADIUS_DEG * ring;
                const angle = slot * GOLDEN_ANGLE;
                result[idx] = {
                    ...item,
                    _loc: {
                        lat: loc.lat + radius * Math.cos(angle),
                        lng: loc.lng + radius * Math.sin(angle),
                    },
                };
            }
        });
    });
    return result.filter(Boolean);
};

// ── Auto Zoom to Pickup/Destination ───────────────────────────────────────────
const ZoomToLocation = ({ pickup, destination }) => {
    const map = useMap();

    useEffect(() => {
        const getLoc = (obj) => {
            if (!obj) return null;
            if (obj.lat !== undefined) return { lat: obj.lat, lng: obj.lng };
            if (obj.coordinates) return { lat: obj.coordinates[1], lng: obj.coordinates[0] };
            return null;
        };
        const p = getLoc(pickup);
        const d = getLoc(destination);

        if (p && !d) { map.flyTo([p.lat, p.lng], 18, { duration: 1.0 }); }
        if (!p && d) { map.flyTo([d.lat, d.lng], 18, { duration: 1.0 }); }
        if (p && d) {
            map.fitBounds(L.latLngBounds([p.lat, p.lng], [d.lat, d.lng]), { padding: [60, 60], animate: true, duration: 1.5 });
        }
    }, [pickup, destination, map]);

    return null;
};

// ── FlyTo / PanTo ─────────────────────────────────────────────────────────────
// Behaviour:
//   location.zoom set  → flyTo at that zoom (explicit "go here" like My Location)
//   location.zoom not set → panTo only (no zoom change, for clicking markers in lists)
//   location.type === 'route' → fitBounds to show full route
//
// NO throttling — every distinct focusLocation value triggers a move.
// (Simulation no longer sets focusLocation, so this is safe.)
const FlyToLocation = ({ location }) => {
    const map = useMap();

    useEffect(() => {
        if (!location) return;

        let focusTarget = null;
        let isRoute = false;

        if (location.type === 'route' && location.pickup && location.destination) {
            const getLoc = (obj) => {
                if (!obj) return null;
                if (obj.lat !== undefined) return { lat: obj.lat, lng: obj.lng };
                if (obj.coordinates) return { lat: obj.coordinates[1], lng: obj.coordinates[0] };
                return null;
            };
            const p = getLoc(location.pickup);
            const d = getLoc(location.destination);
            if (p && d) { focusTarget = L.latLngBounds([p.lat, p.lng], [d.lat, d.lng]); isRoute = true; }
        }

        if (!focusTarget) {
            const lat = location.lat ?? location.coordinates?.[1];
            const lng = location.lng ?? location.coordinates?.[0];
            if (lat !== undefined && lng !== undefined) focusTarget = [lat, lng];
        }

        if (!focusTarget) return;

        if (isRoute) {
            map.fitBounds(focusTarget, { padding: [60, 60], animate: true, duration: 1.0 });
        } else if (typeof location.zoom === 'number') {
            // Explicit zoom requested (e.g. "My Location" button) — fly with zoom change
            map.flyTo(focusTarget, location.zoom, { animate: true, duration: 1.0 });
        } else {
            // No zoom specified — pan ONLY, keep current zoom level.
            // This ensures clicking a passenger/driver in the list doesn't re-zoom
            // and all nearby markers stay visible together in the same viewport.
            map.panTo(focusTarget, { animate: true, duration: 0.6 });
        }
    }, [location, map]);

    return null;
};

// ── Map Click Events ──────────────────────────────────────────────────────────
const MapEvents = ({ setPickup, setDestination, pickup, destination }) => {
    useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            if (!pickup) setPickup({ lat, lng });
            else if (!destination) setDestination({ lat, lng });
        }
    });
    return null;
};

// ── Main Map Component ────────────────────────────────────────────────────────
const LeafletMap = ({
    pickup,
    setPickup,
    destination,
    setDestination,
    onRouteFound,
    userLocation,
    drivers = [],
    passengers = [],
    userRole,
    focusLocation,
    isLocked = false,
    // Simulation props (new ref-based approach — no React re-renders for car movement)
    simCarPosRef = null,          // React ref holding current sim car position
    isSimActive = false,          // Boolean: whether to show the sim car marker
    hideUserMarker = false,
    hideAccuracyCircle = false,
    hidePassengerMarkers = false,
    simRouteEndpoints = null,
    onPassengerClick = null,      // callback(realLocation) when a passenger marker is clicked
    onDriverClick = null,         // callback(realLocation) when a driver marker is clicked
}) => {
    const defaultCenter = [-1.9441, 30.0619];

    return (
        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
            <MapContainer
                center={defaultCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
                zoomSnap={0.1}
                preferCanvas={true}
            >
                <LayersControl position="topleft">
                    <LayersControl.BaseLayer checked name="OpenStreetMap">
                        <TileLayer
                            attribution='&copy; OpenStreetMap contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            maxZoom={19}
                            keepBuffer={4}
                            updateWhenZooming={false}
                            updateWhenIdle={true}
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Satellite">
                        <TileLayer
                            attribution='&copy; Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            maxZoom={19}
                            keepBuffer={4}
                            updateWhenZooming={false}
                            updateWhenIdle={true}
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Topo">
                        <TileLayer
                            attribution='&copy; OpenTopoMap'
                            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                            maxZoom={17}
                            keepBuffer={4}
                            updateWhenZooming={false}
                            updateWhenIdle={true}
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                <ZoomToLocation pickup={pickup} destination={destination} />
                <FlyToLocation location={focusLocation} />

                {/* User location marker */}
                {userLocation && !hideUserMarker && (
                    <>
                        <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                            {!isLocked && <Popup autoClose={false} closeOnClick={false}>Your Location</Popup>}
                        </Marker>
                        {!hideAccuracyCircle && (
                            <Circle
                                center={[userLocation.lat, userLocation.lng]}
                                radius={150}
                                pathOptions={{ fillColor: '#1E6BB5', fillOpacity: 0.1, color: '#1E6BB5', weight: 1, dashArray: '5, 5' }}
                            />
                        )}
                    </>
                )}

                {/* Sim car — RAF-interpolated, zero React re-renders per position update */}
                {simCarPosRef && (
                    <SimCarMarker positionRef={simCarPosRef} active={isSimActive} />
                )}

                {pickup && (
                    <Marker
                        position={[pickup.lat, pickup.lng]}
                        icon={pickupIcon}
                        draggable={!isLocked}
                        eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); setPickup({ lat: p.lat, lng: p.lng, address: pickup.address || 'Pickup' }); } }}
                    >
                        <Popup autoClose={false}>
                            <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-emerald-600 uppercase tracking-tighter text-[10px]">Pickup</span>
                                {pickup.address && <span className="text-[11px] leading-tight font-medium">{pickup.address}</span>}
                                {!isLocked && <span style={{ fontSize: '9px', opacity: 0.5 }} className="mt-1 italic">Drag to adjust</span>}
                            </div>
                        </Popup>
                    </Marker>
                )}

                {destination && (
                    <Marker
                        position={[destination.lat, destination.lng]}
                        icon={destinationIcon}
                        draggable={!isLocked}
                        eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); setDestination({ lat: p.lat, lng: p.lng, address: destination.address || 'Destination' }); } }}
                    >
                        <Popup autoClose={false}>
                            <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-red-600 uppercase tracking-tighter text-[10px]">Destination</span>
                                {destination.address && <span className="text-[11px] leading-tight font-medium">{destination.address}</span>}
                                {!isLocked && <span style={{ fontSize: '9px', opacity: 0.5 }} className="mt-1 italic">Drag to adjust</span>}
                            </div>
                        </Popup>
                    </Marker>
                )}

                <RoutingEngine pickup={pickup} destination={destination} onRouteFound={onRouteFound} />
                <MapEvents pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} />

                {/* Orange dashed simulation route */}
                {simRouteEndpoints?.from && simRouteEndpoints?.to && (
                    <SimulationRoute from={simRouteEndpoints.from} to={simRouteEndpoints.to} />
                )}

                {/* Driver markers — spread co-located markers so all are visible */}
                {spreadColocated(
                    drivers.filter(d => d.location),
                    d => d.location
                ).map((driver, i) => {
                    const loc = driver._loc;           // offset display position
                    const realLoc = driver.location;   // real GPS position for zoom
                    if (!loc) return null;
                    return (
                        <Marker
                            key={driver._id ? `driver-${driver._id}` : `driver-idx-${i}`}
                            position={[loc.lat, loc.lng]}
                            icon={carIcon}
                            eventHandlers={{
                                click: () => onDriverClick && onDriverClick(realLoc)
                            }}
                        >
                            {!isLocked && (
                                <Popup>
                                    <div style={{ color: '#000', fontSize: '12px', padding: '2px 4px' }}>
                                        <p style={{ fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', color: '#000', marginBottom: '2px' }}>Driver</p>
                                        <p style={{ fontWeight: 700, color: '#111' }}>{driver.fullName || 'Driver'}</p>
                                    </div>
                                </Popup>
                            )}
                        </Marker>
                    );
                })}

                {/* Passenger markers — spread co-located markers */}
                {!hidePassengerMarkers && spreadColocated(
                    passengers.map(p => {
                        const loc = p.location?.lat
                            ? p.location
                            : p.location?.coordinates
                                ? { lat: p.location.coordinates[1], lng: p.location.coordinates[0] }
                                : null;
                        return { ...p, location: loc };
                    }).filter(p => p.location),
                    p => p.location
                ).map((passenger, i) => {
                    const loc = passenger._loc;          // offset display position
                    const realLoc = passenger.location;  // real GPS position for zoom
                    if (!loc) return null;
                    const pid = passenger.userId || passenger._id;
                    return (
                        <Marker
                            key={pid ? `pass-${pid}` : `pass-idx-${i}`}
                            position={[loc.lat, loc.lng]}
                            icon={passengerIcon}
                            eventHandlers={{
                                click: () => onPassengerClick && onPassengerClick(realLoc)
                            }}
                        >
                            {!isLocked && (
                                <Popup>
                                    <div style={{ color: '#000', fontSize: '12px', padding: '2px 4px' }}>
                                        <p style={{ fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', color: '#059669', marginBottom: '2px' }}>Passenger</p>
                                        <p style={{ fontWeight: 700, color: '#111' }}>{passenger.fullName || 'Passenger'}</p>
                                    </div>
                                </Popup>
                            )}
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
};

export default LeafletMap;
