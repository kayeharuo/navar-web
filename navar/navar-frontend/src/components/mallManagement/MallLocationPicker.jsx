import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER = [12.8797, 121.774]
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'

function locationFromPlace(place) {
  const details = place.address || {}
  return {
    latitude: Number(place.lat),
    longitude: Number(place.lon),
    address: place.display_name || '',
    city: details.city || details.town || details.municipality || details.city_district || details.village || details.county || '',
    province: details.province || details.state || details.region || details.state_district || '',
    zipCode: details.postcode || '',
    label: place.display_name || 'Selected map location',
  }
}

function MapViewport({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 0.5 })
  }, [map, position])
  return null
}

function MapClick({ onPick }) {
  useMapEvents({ click: event => onPick(event.latlng.lat, event.latlng.lng) })
  return null
}

async function searchPlaces(query) {
  const response = await fetch(`${NOMINATIM_URL}/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ph&q=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error('Location search failed.')
  return response.json()
}

async function reversePlace(latitude, longitude) {
  const response = await fetch(`${NOMINATIM_URL}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}`)
  if (!response.ok) throw new Error('Address lookup failed.')
  return response.json()
}

export default function MallLocationPicker({ query, address, latitude, longitude, onConfirm }) {
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [pending, setPending] = useState(latitude != null && longitude != null ? {
    latitude: Number(latitude), longitude: Number(longitude), address: address || '', label: address || 'Saved mall location',
  } : null)
  const position = pending ? [pending.latitude, pending.longitude] : DEFAULT_CENTER

  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setSuggestions([])
      return undefined
    }
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      try {
        setSuggestions(await searchPlaces(`${query.trim()}, Philippines`))
      } catch (error) {
        setSearchError(error.message)
      } finally {
        setSearching(false)
      }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [query])

  async function choosePlace(place) {
    setPending(locationFromPlace(place))
    setSuggestions([])
  }

  async function pickCoordinates(nextLatitude, nextLongitude) {
    setSearchError('')
    try {
      const place = await reversePlace(nextLatitude, nextLongitude)
      setPending({ ...locationFromPlace({ ...place, lat: nextLatitude, lon: nextLongitude }), address: place.display_name || address })
    } catch (error) {
      setSearchError(error.message)
      setPending({ latitude: nextLatitude, longitude: nextLongitude, address, label: 'Selected map location' })
    }
  }

  return (
    <div className="mall-location-picker">
      <div className="mall-location-picker-head">
        <div>
          <p className="mall-field-label">LOCATION ON MAP</p>
          <p className="mall-field-hint">Search the mall name or click the map. We will fill in the address, city, province, ZIP code, and coordinates after you confirm the location.</p>
        </div>
        {searching && <span className="mall-location-searching">Searching...</span>}
      </div>
      {suggestions.length > 0 && (
        <div className="mall-location-suggestions">
          {suggestions.map(place => (
            <button type="button" key={place.place_id} onClick={() => choosePlace(place)}>
              <strong>{place.name || place.display_name.split(',')[0]}</strong>
              <span>{place.display_name}</span>
            </button>
          ))}
        </div>
      )}
      {searchError && <p className="mall-field-error">{searchError}</p>}
      <div className="mall-location-map-wrap">
        <MapContainer center={position} zoom={pending ? 16 : 6} scrollWheelZoom className="mall-location-map">
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapViewport position={pending ? [pending.latitude, pending.longitude] : null} />
          <MapClick onPick={pickCoordinates} />
          {pending && <CircleMarker center={[pending.latitude, pending.longitude]} radius={10} pathOptions={{ color: '#155DFC', fillColor: '#2563EB', fillOpacity: 0.85 }} />}
        </MapContainer>
      </div>
      {pending && (
        <div className="mall-location-confirm">
          <div>
            <strong>Are you referring to this map?</strong>
            <span>{pending.label}</span>
            <small>{pending.latitude.toFixed(6)}, {pending.longitude.toFixed(6)}</small>
          </div>
          <button type="button" onClick={() => onConfirm(pending)}>Use this location</button>
        </div>
      )}
    </div>
  )
}
