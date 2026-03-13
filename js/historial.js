document.addEventListener("DOMContentLoaded", async function(){

let historyData=[]
let filteredData=[]

let currentPage=1
const rowsPerPage=6

// ==============================
// CARGAR HISTORIAL
// ==============================

async function loadHistory(){

const res=await fetch("/api/historial")

historyData=await res.json()

filteredData=[...historyData]

renderKPIs()
renderTable()

}

// ==============================
// UTILIDADES
// ==============================

function calculateDuration(start,end){

if(!end) return "En curso"

const [sh,sm]=start.split(":").map(Number)
const [eh,em]=end.split(":").map(Number)

const startMinutes=sh*60+sm
const endMinutes=eh*60+em

const diff=endMinutes-startMinutes

if(diff<=0) return "-"

const h=Math.floor(diff/60)
const m=diff%60

return `${h}h ${m}m`

}

function formatMoney(value){

return "$"+Number(value||0).toLocaleString()

}

// ==============================
// KPIs
// ==============================

function renderKPIs(){

let visits=historyData.length
let revenue=0
let pending=0
let totalMinutes=0
let completed=0

historyData.forEach(item=>{

revenue+=Number(item.paid||0)

if(!item.exit) pending++

if(item.entry && item.exit){

const [sh,sm]=item.entry.split(":").map(Number)
const [eh,em]=item.exit.split(":").map(Number)

const diff=(eh*60+em)-(sh*60+sm)

if(diff>0){
totalMinutes+=diff
completed++
}

}

})

const avgMinutes=completed ? totalMinutes/completed : 0
const avgHours=(avgMinutes/60).toFixed(1)

document.getElementById("kpiVisits").innerText=visits
document.getElementById("kpiRevenue").innerText=formatMoney(revenue)
document.getElementById("kpiPending").innerText=pending
document.getElementById("kpiAvgTime").innerText=avgHours+"h"

}

// ==============================
// RENDER TABLA
// ==============================

function renderTable(dataToRender=null){

const tbody=document.getElementById("historyTableBody")

if(!tbody) return

tbody.innerHTML=""

const source=dataToRender || filteredData

const sorted=[...source].sort(
(a,b)=> new Date(b.date+" "+b.entry) - new Date(a.date+" "+a.entry)
)

const start=(currentPage-1)*rowsPerPage
const end=start+rowsPerPage

const pageData=sorted.slice(start,end)

if(pageData.length===0){

tbody.innerHTML=`
<tr>
<td colspan="6" class="px-6 py-8 text-center text-slate-400">
No hay movimientos
</td>
</tr>
`

return

}

pageData.forEach(record=>{

const tr=document.createElement("tr")

tr.className="hover:bg-slate-50"

tr.innerHTML=`

<td class="px-6 py-4 text-sm">
${record.date}
</td>

<td class="px-6 py-4 font-mono text-sm">
${record.entry}
</td>

<td class="px-6 py-4 font-mono text-sm">
${record.exit || "-"}
</td>

<td class="px-6 py-4 font-bold text-slate-800">
${record.plate}
</td>

<td class="px-6 py-4">
${record.type}
</td>

<td class="px-6 py-4 text-sm">
${calculateDuration(record.entry,record.exit)}
</td>

`

tbody.appendChild(tr)

})

renderPagination(source.length)

}

// ==============================
// PAGINACION
// ==============================

function renderPagination(totalItems){

const container=document.getElementById("paginationControls")
const info=document.getElementById("paginationInfo")

if(!container || !info) return

container.innerHTML=""

const totalPages=Math.ceil(totalItems/rowsPerPage)

const startRecord= totalItems===0
?0
:(currentPage-1)*rowsPerPage+1

const endRecord=Math.min(currentPage*rowsPerPage,totalItems)

info.innerText=`Mostrando ${startRecord} a ${endRecord} de ${totalItems} registros`

for(let i=1;i<=totalPages;i++){

const btn=document.createElement("button")

btn.innerText=i

btn.className=`
page-btn w-8 h-8 rounded
${i===currentPage
?"bg-blue-600 text-white"
:"text-slate-600 border"}
`

btn.onclick=()=>{
currentPage=i
renderTable()
}

container.appendChild(btn)

}

}

// ==============================
// FILTROS
// ==============================

window.applyFilters=function(){

const dateStart=document.getElementById("filterDateStart").value
const dateEnd=document.getElementById("filterDateEnd").value
const plate=document.getElementById("filterPlate").value.toUpperCase()

filteredData=historyData.filter(item=>{

let match=true

if(dateStart && item.date < dateStart) match=false

if(dateEnd && item.date > dateEnd) match=false

if(plate && !item.plate.includes(plate)) match=false

return match

})

currentPage=1

renderTable()

}

// ==============================
// FECHA
// ==============================

const fecha=document.getElementById("fecha-actual")

if(fecha){

fecha.textContent=new Date()
.toLocaleDateString("es-ES",{
weekday:"long",
year:"numeric",
month:"long",
day:"numeric"
})

}

// ==============================

loadHistory()

})