import SystemSettingsTabs from '../components/systemSettings/SystemSettingsTabs'
import '../styles/systemSettings/systemSettings.css'
import '../styles/systemSettings/systemSettingsLayout.css'

export default function SystemSettings() {
  return (
    <div className="settings-page">
      <SystemSettingsTabs />
    </div>
  )
}
