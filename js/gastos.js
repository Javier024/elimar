document.addEventListener("DOMContentLoaded", function () {
  let gastosData = []
  let currentPage = 1
  const rowsPerPage = 5

  async function loadGastos(){
    try{
      const res = await fetch("/api/gastos")
      gastosData = await res.json()
      renderTable()
    }catch(err){ console.error("Error cargando gastos",err) }
  }

  function formatMoney(amount){ return "$" + parseFloat(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,".") }
  function getCategoryColor(cat){
    if (cat === "Mantenimiento") return "bg-blue-50 text-blue-700 border-blue-100"
    if (cat === "Nómina") return "bg-purple-50 text-purple-700 border-purple-100"
    if (cat === "Impuestos") return "bg-red-50 text-red-700 border-red-100"
    if (cat === "Insumos") return "bg-green-50 text-green-700 border-green-100"
    return "bg-orange-50 text-orange-700 border-orange-100"
  }

  function renderTable(){
    const tbody = document.getElementById("listaGastosBody"); if(!tbody) return; tbody.innerHTML=""
    const sorted=[...gastosData].sort((a,b)=>b.id-a.id)
    const start=(currentPage-1)*rowsPerPage; const end=start+rowsPerPage
    const pageData=sorted.slice(start,end)

    let totalSpent=0; let topExpense={amount:0,concept:"-"}
    gastosData.forEach(g=>{ const amount=parseFloat(g.amount); totalSpent+=amount; if(amount>topExpense.amount) topExpense=g })
    const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.innerText=val }
    set("kpiTotal",formatMoney(totalSpent)); set("kpiTopConcept",topExpense.concept); set("kpiTopAmount",formatMoney(topExpense.amount)); set("kpiCount",gastosData.length)

    pageData.forEach(gasto=>{
      const tr=document.createElement("tr")
      const catColor=getCategoryColor(gasto.category)
      tr.innerHTML=`<td class="px-6 py-4 text-sm">${gasto.date}</td><td class="px-6 py-4 font-medium">${gasto.concept}</td><td class="px-6 py-4"><span class="px-2 py-1 text-xs border rounded ${catColor}">${gasto.category}</span></td><td class="px-6 py-4 text-right font-bold text-red-500">${formatMoney(gasto.amount)}</td><td class="px-6 py-4 text-right"><button onclick="deleteGasto(${gasto.id})" class="text-red-500 text-xs">Eliminar</button></td>`
      tbody.appendChild(tr)
    })
    renderPaginationControls(gastosData.length)
  }

  function renderPaginationControls(totalItems){
    const container=document.getElementById("paginationControls"); const info=document.getElementById("paginationInfo")
    if(!container || !info) return; container.innerHTML=""
    const totalPages=Math.ceil(totalItems/rowsPerPage)
    const startRecord=totalItems===0 ?0 :(currentPage-1)*rowsPerPage+1
    const endRecord=Math.min(currentPage*rowsPerPage,totalItems)
    info.innerText=`Mostrando ${startRecord} a ${endRecord} de ${totalItems}`
    for(let i=1;i<=totalPages;i++){
      const btn=document.createElement("button"); btn.innerText=i; btn.className="px-2 py-1 text-xs border rounded mx-1"
      btn.onclick=()=>{ currentPage=i; renderTable() }; container.appendChild(btn)
    }
  }

  window.guardarGasto = async function(){
    const concept=document.getElementById("gastoConcepto").value
    const category=document.getElementById("gastoCategoria").value
    const amount=document.getElementById("gastoMonto").value
    const date=document.getElementById("gastoFecha").value
    if(!concept || !amount || amount<=0){ alert("Ingrese concepto y monto válido"); return }
    await fetch("/api/gastos",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({concept,category,amount,date}) })
    document.getElementById("formGasto").reset(); loadGastos()
  }

  window.deleteGasto = async function(id){
    if(!confirm("¿Eliminar gasto?")) return
    await fetch("/api/gastos?id="+id,{ method:"DELETE" }); loadGastos()
  }

  const fechaElement=document.getElementById("fecha-actual")
  if(fechaElement){ fechaElement.textContent=new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"}) }
  loadGastos()
})