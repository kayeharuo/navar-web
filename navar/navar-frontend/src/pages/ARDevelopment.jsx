import ARDevTable from '../components/arDevelopment/ARDevTable'
import '../styles/arDevelopment/arDevelopmentLayout.css'
import '../styles/arDevelopment/arDevelopment.css'

export default function ARDevelopment({ incomingProjects, stallApplications }) {
  return (
    <div className="ar-dev-page">
      <div className="ar-dev-content">
        <ARDevTable incomingProjects={incomingProjects} stallApplications={stallApplications} />
      </div>
    </div>
  )
}
