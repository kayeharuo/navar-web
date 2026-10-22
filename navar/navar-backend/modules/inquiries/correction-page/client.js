(() => {
 const token=location.hash.slice(1)
 history.replaceState(null,'',location.pathname)
 const form=document.getElementById('correction-form'),status=document.getElementById('status'),button=document.getElementById('submit')
 const definitions=[['mallName','Mall name',100,true],['contactPerson','Contact person',100,true],['phone','Contact number',30,true],['province','Province',50,true],['city','City / Municipality',50,true],['address','Full address',200,true],['barangay','Barangay',100,true],['zipCode','ZIP code',10,false],['floors','Number of floors',3,true],['coverageArea','Coverage area',150,false],['description','Inquiry message',3000,false]]
 async function request(fields) {
  const response=await fetch('/api/inquiry-corrections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,...(fields?{fields}:{})})})
  const data=await response.json()
  if(!response.ok)throw new Error(data.message || 'Unable to load inquiry.')
  return data
 }
 async function load() {
  try {
   const data=await request()
   document.getElementById('instructions').textContent=data.instructions
   document.getElementById('contact').textContent=`Contact email: ${data.email}`
   const container=document.getElementById('fields')
   for(const [key,title,max,required] of definitions) {
    const label=document.createElement('label');label.textContent=title+(required?' *':'')
    const input=document.createElement(key==='description'?'textarea':'input');input.name=key;input.required=required;input.maxLength=max;input.value=data.fields[key]??''
    if(key==='floors'){input.type='number';input.min='1';input.max='300';input.step='1'}
    if(key==='phone'){input.type='tel';input.placeholder='+63 912 345 6789'}
    label.append(input);container.append(label)
   }
   form.hidden=false
  }catch(error){document.getElementById('instructions').textContent='Unable to open this inquiry.';status.textContent=error.message}
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();button.disabled=true;button.textContent='Submitting…';status.textContent=''
  try {
   const fields=Object.fromEntries(new FormData(form));fields.floors=Number(fields.floors)
   await request(fields);form.hidden=true;status.textContent='Your updated inquiry has been submitted. NavAR will review it and contact you by email.'
  }catch(error){status.textContent=error.message;button.disabled=false;button.textContent='Submit updated inquiry'}
 })
 void load()
})()
