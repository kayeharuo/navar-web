import Badge from '../ui/Badge'
import '../../styles/dashboard/dashboard.css'

const malls = [
  { name: 'SM Seaside City Cebu',       note: null,              tier: 'Premium',  wallet: '45,000.00', agreement: 'Active',       agreementVariant: 'active',    application: 'Approved',     applicationVariant: 'approved', arDev: 'Live',              arDevVariant: 'live'        },
  { name: 'Ayala Center Cebu',          note: '27 Days Overdue', tier: 'Premium',  wallet: '5,000.00',  agreement: 'Grace Period', agreementVariant: 'grace',     application: 'Approved',     applicationVariant: 'approved', arDev: 'Live',              arDevVariant: 'live'        },
  { name: 'Robinsons Galleria Cebu',    note: null,              tier: 'Standard', wallet: '80,000.00', agreement: 'Setup',        agreementVariant: 'setup',     application: 'Approved',     applicationVariant: 'approved', arDev: 'Node Mapping',      arDevVariant: 'pending'     },
  { name: 'Parkmall',                   note: null,              tier: 'Basic',    wallet: '0',         agreement: 'Suspended',    agreementVariant: 'suspended', application: 'Approved',     applicationVariant: 'approved', arDev: 'Unpublished',       arDevVariant: 'unpublished' },
  { name: 'Pacific Mall Cebu',          note: null,              tier: 'Standard', wallet: '12,000.00', agreement: 'Setup',        agreementVariant: 'setup',     application: 'For Revision', applicationVariant: 'revision', arDev: '—',                 arDevVariant: 'default'     },
  { name: 'SM City North Edsa',         note: null,              tier: 'Premium',  wallet: '92,000.00', agreement: 'Active',       agreementVariant: 'active',    application: 'Approved',     applicationVariant: 'approved', arDev: 'Live',              arDevVariant: 'live'        },
  { name: 'Mall of Asia',               note: null,              tier: 'Premium',  wallet: '110,000.00',agreement: 'Active',       agreementVariant: 'active',    application: 'Approved',     applicationVariant: 'approved', arDev: 'Live',              arDevVariant: 'live'        },
  { name: 'Greenbelt Mall',             note: null,              tier: 'Premium',  wallet: '75,000.00', agreement: 'Active',       agreementVariant: 'active',    application: 'Approved',     applicationVariant: 'approved', arDev: 'Navigation Testing', arDevVariant: 'pending'    },
  { name: 'Trinoma',                    note: null,              tier: 'Standard', wallet: '40,000.00', agreement: 'Active',       agreementVariant: 'active',    application: 'Approved',     applicationVariant: 'approved', arDev: 'Ready for Activation', arDevVariant: 'pending' },
  { name: 'Glorietta',                  note: null,              tier: 'Standard', wallet: '38,000.00', agreement: 'Active',       agreementVariant: 'active',    application: 'Approved',     applicationVariant: 'approved', arDev: 'Navigation Testing', arDevVariant: 'pending'    },
  { name: 'Eastwood City Mall',         note: null,              tier: 'Standard', wallet: '22,000.00', agreement: 'Setup',        agreementVariant: 'setup',     application: 'Approved',     applicationVariant: 'approved', arDev: 'Node Mapping',      arDevVariant: 'pending'     },
  { name: 'Abreeza Mall',               note: null,              tier: 'Standard', wallet: '28,000.00', agreement: 'Active',       agreementVariant: 'active',    application: 'Approved',     applicationVariant: 'approved', arDev: 'Live',              arDevVariant: 'live'        },
  { name: 'Gaisano Mall of Davao',      note: null,              tier: 'Basic',    wallet: '15,000.00', agreement: 'Setup',        agreementVariant: 'setup',     application: 'Approved',     applicationVariant: 'approved', arDev: 'Node Mapping',      arDevVariant: 'pending'     },
  { name: 'Centrio Mall',               note: null,              tier: 'Standard', wallet: '19,000.00', agreement: 'Active',       agreementVariant: 'active',    application: 'Approved',     applicationVariant: 'approved', arDev: 'Live',              arDevVariant: 'live'        },
  { name: 'Limketkai Center',           note: null,              tier: 'Basic',    wallet: '11,000.00', agreement: 'Setup',        agreementVariant: 'setup',     application: 'For Revision', applicationVariant: 'revision', arDev: '—',                 arDevVariant: 'default'     },
  { name: 'Robinson Place Iloilo',      note: null,              tier: 'Standard', wallet: '24,000.00', agreement: 'Active',       agreementVariant: 'active',    application: 'Approved',     applicationVariant: 'approved', arDev: 'Ready for Activation', arDevVariant: 'pending' },
  { name: 'SM City Bacolod',            note: null,              tier: 'Standard', wallet: '21,000.00', agreement: 'Setup',        agreementVariant: 'setup',     application: 'Approved',     applicationVariant: 'approved', arDev: 'Node Mapping',      arDevVariant: 'pending'     },
]

export default function MallTable() {
  return (
    <div className="dash-card dash-card--table">
      {/* Header */}
      <div className="dash-table-header">
        <div className="dash-card-title">
          <span className="dash-card-accent" style={{ backgroundColor: '#22C55E' }} />
          <span className="dash-card-label">Mall Information Summary</span>
        </div>
        <div className="dash-table-meta">
          <span className="dash-table-count">17 malls</span>
          <button className="dash-table-show-all">Show All</button>
        </div>
      </div>

      {/* Scrollable area — fills remaining card height */}
      <div className="dash-table-scroll">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Mall</th>
              <th>Tier</th>
              <th>Wallet (₱)</th>
              <th>Agreement</th>
              <th>Application</th>
              <th>AR Development</th>
            </tr>
          </thead>
          <tbody>
            {malls.map((mall, i) => (
              <tr key={i}>
                <td>
                  <span className={`dash-table-mall-name${
                    mall.agreementVariant === 'grace'
                      ? ' dash-table-mall-name--grace'
                      : mall.agreementVariant === 'ed'
                      ? ' dash-table-mall-name--suspended'
                      : ''
                  }`}>
                    {mall.name}
                  </span>
                  {mall.note && <p className="dash-table-mall-note">{mall.note}</p>}
                </td>
                <td>{mall.tier}</td>
                <td><span className="dash-table-wallet">{mall.wallet}</span></td>
                <td><Badge label={mall.agreement}   variant={mall.agreementVariant}   /></td>
                <td><Badge label={mall.application} variant={mall.applicationVariant} /></td>
                <td><Badge label={mall.arDev}       variant={mall.arDevVariant}       /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}