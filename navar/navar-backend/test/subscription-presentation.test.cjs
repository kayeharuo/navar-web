const {test}=require('node:test'),assert=require('node:assert/strict')
const {listSubscriptions}=require('../modules/subscriptions/service')
test('subscription history numbers started terms and uses presentation labels',async()=>{
 const tables={mall:[{mall_id:12,mall_name:'Gaisano Fiesta Mall'}],contract:[{contract_id:19,mall_id:12,contract_version:2,contract_is_current:true,contract_start:'2026-11-23',contract_end:'2027-11-22',contract_status:'active',change_type:'initial',is_test:true,tier_snapshot:{s_tier_label:'Basic'}},{contract_id:14,mall_id:12,contract_version:1,contract_is_current:false,contract_start:null,change_type:'initial'}],contract_payment_request:[{request_id:21,mall_id:12,fee_type:'subscription',status:'paid',amount_cent:2500000,payment_reference:'manual_test:abc'}],subscription_tier:[],suspension:[],onboarding_quote:[]}
 const db={from(table){const q=new Proxy({},{get(_,key){if(key==='then')return resolve=>Promise.resolve({data:tables[table]||[],error:null}).then(resolve);return ()=>q}});return q}}
 const [mall]=await listSubscriptions(db)
 assert.equal(mall.tierHistory.length,1);assert.equal(mall.tierHistory[0].version,'V1');assert.equal(mall.tierHistory[0].note,null)
 assert.equal(mall.paymentHistory[0].type,'Subscription');assert.equal(mall.paymentHistory[0].status,'Paid')
 assert.equal(/test|simulat|initial/i.test(JSON.stringify([mall.tierHistory,mall.paymentHistory.map(({reference,...rest})=>rest)])),false)
})
