import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'

export interface LocationValue {
  locationName?: string
  locationLatitude?: number
  locationLongitude?: number
}

export function LocationCapture({
  value,
  onChange
}: {
  value: LocationValue
  onChange: (value: LocationValue) => void
}) {
  const { t } = useI18n()
  const [message, setMessage] = useState('')

  function captureLocation() {
    if (!navigator.geolocation) {
      setMessage(t('locationUnsupported'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          ...value,
          locationLatitude: Number(position.coords.latitude.toFixed(6)),
          locationLongitude: Number(position.coords.longitude.toFixed(6))
        })
        setMessage(t('locationAdded'))
      },
      () => setMessage(t('locationDenied')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    )
  }

  const hasCoordinates = value.locationLatitude !== undefined && value.locationLongitude !== undefined

  return (
    <div className="grid gap-2">
      <span className="text-sm text-graphite">{t('locationLabel')}</span>
      <input
        className="rounded-md border border-line bg-white/50 px-3 py-3"
        value={value.locationName ?? ''}
        placeholder={t('locationPlaceholder')}
        onChange={(event) => onChange({ ...value, locationName: event.target.value })}
      />
      <button
        type="button"
        className="inline-flex min-h-[42px] w-fit items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite hover:border-ink/50 hover:text-ink"
        onClick={captureLocation}
      >
        <MapPin size={15} />
        {t('addCurrentLocation')}
      </button>
      {hasCoordinates && (
        <p className="text-xs text-graphite">
          {value.locationLatitude}, {value.locationLongitude}
        </p>
      )}
      {message && <p className="text-xs text-moss">{message}</p>}
    </div>
  )
}
