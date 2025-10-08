const BASE=(import.meta.env.VITE_API_BASE?.replace(/\/$/,'')||'http://manabase.quantumaidan.co.za')
export const api={
  async json(path){
    const r=await fetch(`${BASE}${path}`,{headers:{'Accept':'application/json'}})
    if(!r.ok) throw new Error(`HTTP ${r.status}`)
    const t=await r.text(); return JSON.parse(t.replace(/^\uFEFF/,''))
  },
  getMetas:()=>api.json('/api/metas'),
  getLandcycles:()=>api.json('/api/landcycles'),
  getCards:({metas=[],landcycles=[],colors=[]})=>{
    const q=new URLSearchParams()
    metas.forEach(m=>q.append('metas',m))
    landcycles.forEach(l=>q.append('landcycles',l))
    colors.forEach(c=>q.append('colors',c))
    return api.json(`/api/cards?${q.toString()}`)
  }
}
