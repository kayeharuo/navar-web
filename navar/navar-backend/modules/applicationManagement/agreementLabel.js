// Onboarding is the pre-subscription phase, not a subscription contract.
function agreementLabel(contract) {
 const status=String(contract?.contract_status||'').trim().toLowerCase()
 if(!contract?.contract_start||['','setup','pending','onboarding'].includes(status))return 'Onboarding'
 return status.replace(/_/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())
}
module.exports={agreementLabel}
