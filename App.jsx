import { useState, useEffect, useMemo, useRef } from "react";

/* ── TOKENS ─────────────────────────────────────────────── */
const C = {
  bg:'#F4F6F8', card:'#FFFFFF', dark:'#111827', dark2:'#1F2937',
  green:'#00CC96', gLight:'#D1FAF0',
  text:'#111827',  muted:'#6B7280',
  red:'#EF4444',   rLight:'#FEE2E2',
  amber:'#F59E0B', aLight:'#FEF3C7',
  border:'#E5E7EB',
};

const STORE_ICONS = [
  {id:'general',   e:'🏪', l:'Tienda'},
  {id:'bodega',    e:'🛒', l:'Bodega'},
  {id:'carniceria',e:'🥩', l:'Carnic.'},
  {id:'agro',      e:'🥬', l:'Agro'},
  {id:'farmacia',  e:'💊', l:'Farmacia'},
  {id:'panaderia', e:'🍞', l:'Panadera'},
  {id:'ferreteria',e:'🔧', l:'Ferret.'},
  {id:'cafeteria', e:'☕', l:'Cafet.'},
];

const UNITS     = ['und','lb','kg','L','botella','paquete','caja','docena'];
const GASTO_CAT = ['Salario','Impuesto','Merma','Proveedor','Alquiler','Otro'];

/* ── HELPERS ────────────────────────────────────────────── */
const uid      = () => Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const money    = n  => `$${Number(n||0).toFixed(2)}`;
const nowIso   = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0,10);
const fmtDate  = iso => new Date(iso).toLocaleDateString('es-CU',{day:'2-digit',month:'short'});
const fmtTime  = iso => new Date(iso).toLocaleTimeString('es-CU',{hour:'2-digit',minute:'2-digit'});
const daysSince= iso => Math.floor((Date.now()-new Date(iso).getTime())/86400000);

function handleImgFile(file, cb){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      const max=280, r=Math.min(max/img.width,max/img.height,1);
      const cv=document.createElement('canvas');
      cv.width=img.width*r; cv.height=img.height*r;
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      cb(cv.toDataURL('image/jpeg',.65));
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}

/* ── SEED DATA ──────────────────────────────────────────── */
const SEED=[
  {id:'p1', nombre:'Arroz',        foto:null,unidad:'lb',     precioCompra:12, precioVenta:20, stock:50, minStock:10},
  {id:'p2', nombre:'Frijoles',     foto:null,unidad:'lb',     precioCompra:25, precioVenta:40, stock:8,  minStock:10},
  {id:'p3', nombre:'Aceite',       foto:null,unidad:'L',      precioCompra:75, precioVenta:120,stock:15, minStock:5},
  {id:'p4', nombre:'Azúcar',       foto:null,unidad:'lb',     precioCompra:10, precioVenta:18, stock:30, minStock:15},
  {id:'p5', nombre:'Café Serrano', foto:null,unidad:'paquete',precioCompra:90, precioVenta:150,stock:3,  minStock:5},
  {id:'p6', nombre:'Jabón',        foto:null,unidad:'und',    precioCompra:30, precioVenta:55, stock:20, minStock:8},
  {id:'p7', nombre:'Pasta Dental', foto:null,unidad:'und',    precioCompra:45, precioVenta:80, stock:12, minStock:5},
  {id:'p8', nombre:'Pan',          foto:null,unidad:'und',    precioCompra:5,  precioVenta:10, stock:0,  minStock:20},
  {id:'p9', nombre:'Pollo',        foto:null,unidad:'lb',     precioCompra:100,precioVenta:160,stock:25, minStock:10},
  {id:'p10',nombre:'Detergente',   foto:null,unidad:'paquete',precioCompra:50, precioVenta:90, stock:18, minStock:8},
];

/* ── NOTIFICATIONS ──────────────────────────────────────── */
function genNotifs(products, sales, dismissed){
  const out=[];
  const push=n=>{ if(!dismissed.includes(n.id)) out.push(n); };

  products.forEach(p=>{
    if(p.stock===0)
      push({id:`empty-${p.id}`,ico:'🚫',color:C.red,  msg:`Sin stock: ${p.nombre}`});
    else if(p.stock<=p.minStock)
      push({id:`low-${p.id}`,  ico:'⚠️',color:C.amber,msg:`Stock bajo: ${p.nombre} — ${p.stock} ${p.unidad} restantes`});
  });

  if(sales.length>0){
    products.forEach(p=>{
      if(p.stock===0) return;
      const last=[...sales]
        .filter(s=>s.items.some(i=>i.productId===p.id))
        .sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
      const days=last?daysSince(last.fecha):14;
      if(days>=14)
        push({id:`stag-${p.id}`,ico:'📦',color:C.muted,msg:`${p.nombre} lleva ${days} días sin moverse`});
    });

    const qMap={};
    sales.forEach(s=>s.items.forEach(i=>{qMap[i.productId]=(qMap[i.productId]||0)+i.qty;}));
    Object.entries(qMap).sort(([,a],[,b])=>b-a).slice(0,3).forEach(([id])=>{
      const p=products.find(x=>x.id===id);
      if(p&&p.stock<=p.minStock*2&&p.stock>0)
        push({id:`star-${p.id}`,ico:'🌟',color:C.green,msg:`${p.nombre} es tu mejor vendedor — considera reabastecerte`});
    });
  }

  return out;
}

/* ── BASE COMPONENTS ────────────────────────────────────── */
const si={width:'100%',padding:'12px 14px',borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:15,outline:'none',background:'#FAFAFA',fontFamily:'inherit',color:C.text,boxSizing:'border-box'};

function Btn({children,onClick,v='primary',full,style={},disabled}){
  const vs={
    primary:{bg:C.green, fg:'#fff',  bo:'none'},
    danger: {bg:C.red,   fg:'#fff',  bo:'none'},
    ghost:  {bg:'transparent',fg:C.muted,bo:`1.5px solid ${C.border}`},
    outline:{bg:'transparent',fg:C.green,bo:`1.5px solid ${C.green}`},
  };
  const vr=vs[v]||vs.primary;
  return(
    <button onClick={disabled?undefined:onClick}
      style={{background:vr.bg,color:vr.fg,border:vr.bo,borderRadius:12,padding:'13px 20px',fontWeight:700,fontSize:15,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,width:full?'100%':'auto',fontFamily:'inherit',...style}}>
      {children}
    </button>
  );
}

function Lbl({children}){
  return <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,textTransform:'uppercase',letterSpacing:'.5px'}}>{children}</div>;
}
function Inp({label,style={},mb=14,...p}){
  return <div style={{marginBottom:mb}}>{label&&<Lbl>{label}</Lbl>}<input style={{...si,...style}} {...p}/></div>;
}
function Sel({label,children,...p}){
  return <div style={{marginBottom:14}}>{label&&<Lbl>{label}</Lbl>}<select style={{...si,appearance:'none'}} {...p}>{children}</select></div>;
}
function Card({children,s={},onClick}){
  return <div onClick={onClick} style={{background:C.card,borderRadius:16,padding:16,boxShadow:'0 1px 4px rgba(0,0,0,.08)',...s}}>{children}</div>;
}

function Sheet({children,onClose,title}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:200,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,borderRadius:'20px 20px 0 0',maxHeight:'93vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'14px 16px 10px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontWeight:800,fontSize:17,color:C.text}}>{title}</div>
          <button onClick={onClose} style={{background:C.bg,border:'none',borderRadius:20,width:32,height:32,fontSize:20,cursor:'pointer',color:C.muted,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
        <div style={{overflowY:'auto',flex:1}}>{children}</div>
      </div>
    </div>
  );
}

function Mdl({children,onClose,title}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,borderRadius:20,width:'100%',maxWidth:460,maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'16px 20px 12px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontWeight:800,fontSize:17,color:C.text}}>{title}</div>
          <button onClick={onClose} style={{background:C.bg,border:'none',borderRadius:20,width:32,height:32,fontSize:20,cursor:'pointer',color:C.muted,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'16px 20px'}}>{children}</div>
      </div>
    </div>
  );
}

function ToastEl({t}){
  if(!t) return null;
  return(
    <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',background:t.ok?'#064E3B':'#7F1D1D',color:'#fff',padding:'11px 22px',borderRadius:12,fontWeight:700,fontSize:14,boxShadow:'0 4px 20px rgba(0,0,0,.25)',zIndex:1000,maxWidth:'88vw',textAlign:'center',whiteSpace:'nowrap'}}>
      {t.msg}
    </div>
  );
}

function PAv({foto,nombre,size=44}){
  const cs=['#D1FAF0','#FEF3C7','#EDE9FE','#FCE7F3','#DBEAFE'];
  const bg=cs[(nombre||'').charCodeAt(0)%cs.length||0];
  if(foto) return <img src={foto} alt={nombre} style={{width:size,height:size,borderRadius:10,objectFit:'cover',flexShrink:0}}/>;
  return <div style={{width:size,height:size,borderRadius:10,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.42,fontWeight:700,flexShrink:0,color:C.dark}}>{(nombre||'?')[0].toUpperCase()}</div>;
}

function StkBadge({stock,minStock}){
  const [bg,lt]=stock===0?[C.red,C.rLight]:stock<=minStock?[C.amber,C.aLight]:[C.green,C.gLight];
  return <span style={{background:lt,color:bg,borderRadius:20,padding:'3px 10px',fontSize:12,fontWeight:700,flexShrink:0}}>{stock===0?'Sin stock':`${stock}`}</span>;
}

function Bar({value,max,color=C.green}){
  return(
    <div style={{background:C.bg,borderRadius:4,height:7,overflow:'hidden',marginTop:4}}>
      <div style={{width:`${Math.min((value/Math.max(max,1))*100,100)}%`,height:'100%',background:color,borderRadius:4}}/>
    </div>
  );
}

/* ── ONBOARDING ─────────────────────────────────────────── */
function Onboarding({onDone}){
  const [nombre,setNom]=useState('');
  const [icon,setIcon]=useState('general');
  const [foto,setFoto]=useState(null);
  const fRef=useRef();

  const handleFile=e=>handleImgFile(e.target.files[0], setFoto);

  return(
    <div style={{minHeight:'100vh',background:C.dark,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{textAlign:'center',marginBottom:32}}>
        <div style={{fontSize:52,marginBottom:6}}>🛒</div>
        <div style={{color:'#fff',fontSize:30,fontWeight:900,letterSpacing:'-1px'}}>Cuadra<span style={{color:C.green}}>Tech</span></div>
        <div style={{color:C.muted,fontSize:12,letterSpacing:'2.5px',marginTop:4}}>CONTROLA · VENDE · CRECE</div>
      </div>

      <div style={{background:C.card,borderRadius:20,padding:24,width:'100%',maxWidth:380}}>
        <div style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:4}}>Configura tu tienda</div>
        <div style={{color:C.muted,fontSize:13,marginBottom:22}}>Solo lo harás una vez.</div>

        {/* Avatar selector */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:20}}>
          <div onClick={()=>fRef.current.click()}
            style={{width:80,height:80,background:foto?'transparent':C.gLight,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',fontSize:foto?0:40,cursor:'pointer',overflow:'hidden',border:`2.5px dashed ${C.green}`,marginBottom:8}}>
            {foto?<img src={foto} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:STORE_ICONS.find(i=>i.id===icon)?.e}
          </div>
          {foto
            ?<span onClick={()=>setFoto(null)} style={{color:C.red,fontSize:12,fontWeight:700,cursor:'pointer'}}>× Quitar foto</span>
            :<span onClick={()=>fRef.current.click()} style={{color:C.green,fontSize:12,fontWeight:700,cursor:'pointer'}}>+ Subir foto (opcional)</span>
          }
          <input ref={fRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile}/>
        </div>

        {!foto&&(
          <>
            <Lbl>Tipo de negocio</Lbl>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:18}}>
              {STORE_ICONS.map(si=>(
                <button key={si.id} onClick={()=>setIcon(si.id)}
                  style={{border:`2px solid ${icon===si.id?C.green:C.border}`,borderRadius:12,padding:'8px 4px',background:icon===si.id?C.gLight:'#fff',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,fontFamily:'inherit'}}>
                  <span style={{fontSize:22}}>{si.e}</span>
                  <span style={{fontSize:9,color:icon===si.id?C.green:C.muted,fontWeight:700}}>{si.l}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <Inp label="Nombre de la tienda *" value={nombre} onChange={e=>setNom(e.target.value)} placeholder="ej. Bodega Los Pinos"/>
        <Btn full onClick={()=>{if(nombre.trim()) onDone({nombre:nombre.trim(),icon,foto});}} disabled={!nombre.trim()}>
          Empezar →
        </Btn>
      </div>
    </div>
  );
}

/* ── NUEVA VENTA ────────────────────────────────────────── */
function NuevaVenta({products,onClose,onConfirm}){
  const [step,setStep]=useState('cart');
  const [q,setQ]=useState('');
  const [cart,setCart]=useState([]);
  const [pago,setPago]=useState('');

  const avail=products.filter(p=>p.stock>0&&p.nombre.toLowerCase().includes(q.toLowerCase()));
  const total=cart.reduce((a,i)=>a+i.precioVenta*i.qty,0);
  const pagoN=parseFloat(pago)||0;
  const cambio=pagoN-total;

  const addCart=p=>{
    setCart(c=>{
      const ex=c.find(i=>i.productId===p.id);
      if(ex){ if(ex.qty>=p.stock) return c; return c.map(i=>i.productId===p.id?{...i,qty:i.qty+1}:i); }
      return [...c,{productId:p.id,nombre:p.nombre,precioVenta:p.precioVenta,precioCompra:p.precioCompra,unidad:p.unidad,foto:p.foto,qty:1,maxStock:p.stock}];
    });
  };

  const setQty=(id,n)=>{
    const v=parseInt(n)||0;
    if(v<=0) return setCart(c=>c.filter(i=>i.productId!==id));
    setCart(c=>c.map(i=>i.productId!==id?i:{...i,qty:Math.min(v,i.maxStock)}));
  };

  const confirmSale=()=>{
    if(pagoN<total) return;
    onConfirm({items:cart,total,pagado:pagoN,cambio,fecha:nowIso()});
    onClose();
  };

  return(
    <Sheet title={step==='cart'?'Nueva Venta':'Cobrar'} onClose={step==='cart'?onClose:()=>{setStep('cart');setPago('');}}>

      {/* ── CART STEP ── */}
      {step==='cart'&&(
        <>
          <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,background:C.card,zIndex:2}}>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Buscar producto..." style={{...si,background:C.bg}}/>
          </div>

          <div style={{padding:'12px 14px',display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
            {avail.map(p=>{
              const inC=cart.find(i=>i.productId===p.id);
              return(
                <button key={p.id} onClick={()=>addCart(p)}
                  style={{background:inC?C.gLight:C.card,border:`2px solid ${inC?C.green:C.border}`,borderRadius:12,padding:'10px',cursor:'pointer',textAlign:'left',fontFamily:'inherit',position:'relative'}}>
                  <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:6}}>
                    <PAv foto={p.foto} nombre={p.nombre} size={32}/>
                    {inC&&<span style={{position:'absolute',top:7,right:7,background:C.green,color:'#fff',borderRadius:20,minWidth:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800}}>{inC.qty}</span>}
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:C.text,lineHeight:1.3,marginBottom:2}}>{p.nombre}</div>
                  <div style={{fontSize:16,fontWeight:900,color:C.green}}>{money(p.precioVenta)}</div>
                  <div style={{fontSize:10,color:C.muted}}>Stock: {p.stock} {p.unidad}</div>
                </button>
              );
            })}
            {avail.length===0&&<div style={{gridColumn:'1/-1',textAlign:'center',color:C.muted,padding:40,fontSize:13}}>Sin productos disponibles</div>}
          </div>

          {cart.length>0&&(
            <div style={{position:'sticky',bottom:0,background:C.card,borderTop:`2px solid ${C.border}`,padding:'12px 14px'}}>
              <div style={{maxHeight:150,overflowY:'auto',marginBottom:10}}>
                {cart.map(i=>(
                  <div key={i.productId} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:`1px solid ${C.border}`}}>
                    <span style={{flex:1,fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i.nombre}</span>
                    <button onClick={()=>setQty(i.productId,i.qty-1)} style={{width:26,height:26,border:'none',background:C.bg,borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:16,flexShrink:0}}>−</button>
                    <span style={{fontSize:13,fontWeight:700,minWidth:18,textAlign:'center'}}>{i.qty}</span>
                    <button onClick={()=>setQty(i.productId,i.qty+1)} style={{width:26,height:26,border:'none',background:C.bg,borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:16,color:C.green,flexShrink:0}}>+</button>
                    <span style={{fontSize:13,fontWeight:800,minWidth:60,textAlign:'right'}}>{money(i.precioVenta*i.qty)}</span>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                <div>
                  <div style={{fontSize:11,color:C.muted}}>{cart.reduce((a,i)=>a+i.qty,0)} items</div>
                  <div style={{fontWeight:900,fontSize:24,color:C.green,letterSpacing:'-1px'}}>{money(total)}</div>
                </div>
                <Btn onClick={()=>setStep('pago')}>Cobrar →</Btn>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── PAGO STEP ── */}
      {step==='pago'&&(
        <div style={{padding:'18px 16px'}}>
          <div style={{marginBottom:16}}>
            {cart.map(i=>(
              <div key={i.productId} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${C.border}`,fontSize:14}}>
                <span style={{color:C.muted}}>{i.nombre} × {i.qty} {i.unidad}</span>
                <span style={{fontWeight:700}}>{money(i.precioVenta*i.qty)}</span>
              </div>
            ))}
          </div>

          {/* Total — signature element of sale */}
          <div style={{background:C.bg,borderRadius:14,padding:'18px',textAlign:'center',marginBottom:20}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:6}}>Total a Cobrar</div>
            <div style={{fontSize:48,fontWeight:900,color:C.green,letterSpacing:'-2px',lineHeight:1}}>{money(total)}</div>
          </div>

          <Lbl>Monto recibido (CUP)</Lbl>
          <input type="number" value={pago} onChange={e=>setPago(e.target.value)} placeholder="0.00" autoFocus
            style={{...si,fontSize:26,fontWeight:900,textAlign:'right',border:`2px solid ${pago&&pagoN>=total?C.green:C.border}`,marginBottom:12}}/>

          {pago&&(
            <div style={{background:cambio>=0?C.gLight:C.rLight,borderRadius:12,padding:'12px 16px',display:'flex',justifyContent:'space-between',marginBottom:20}}>
              <span style={{fontWeight:800,color:cambio>=0?C.green:C.red,fontSize:16}}>{cambio>=0?'Cambio':'Faltan'}</span>
              <span style={{fontWeight:900,fontSize:20,color:cambio>=0?C.green:C.red}}>{money(Math.abs(cambio))}</span>
            </div>
          )}

          <Btn full onClick={confirmSale} disabled={!pago||pagoN<total}>✓ Confirmar Venta</Btn>
        </div>
      )}
    </Sheet>
  );
}

/* ── INVENTARIO ─────────────────────────────────────────── */
function ProdForm({product,onSave,onClose}){
  const isNew=!product?.id;
  const [f,setF]=useState(product||{nombre:'',unidad:'und',precioCompra:'',precioVenta:'',stock:'',minStock:'5',foto:null});
  const fRef=useRef();

  const handleFile=e=>handleImgFile(e.target.files[0], foto=>setF(p=>({...p,foto})));

  const margin=f.precioCompra&&f.precioVenta&&+f.precioCompra>0
    ?((+f.precioVenta-+f.precioCompra)/+f.precioCompra*100).toFixed(0):null;

  return(
    <Mdl title={isNew?'+ Nuevo Producto':'Editar Producto'} onClose={onClose}>
      <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
        <div onClick={()=>fRef.current.click()}
          style={{width:72,height:72,background:f.foto?'transparent':C.gLight,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:f.foto?0:32,cursor:'pointer',overflow:'hidden',border:`2px dashed ${C.green}`}}>
          {f.foto?<img src={f.foto} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:'📷'}
        </div>
        <input ref={fRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile}/>
      </div>

      <Inp label="Nombre *" value={f.nombre} onChange={e=>setF(p=>({...p,nombre:e.target.value}))} placeholder="ej. Arroz"/>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Sel label="Unidad" value={f.unidad} onChange={e=>setF(p=>({...p,unidad:e.target.value}))}>
          {UNITS.map(u=><option key={u}>{u}</option>)}
        </Sel>
        <Inp label="Stock mínimo" type="number" value={f.minStock} onChange={e=>setF(p=>({...p,minStock:e.target.value}))} placeholder="5"/>
        <Inp label="Precio Compra *" type="number" value={f.precioCompra} onChange={e=>setF(p=>({...p,precioCompra:e.target.value}))} placeholder="0.00"/>
        <Inp label="Precio Venta *" type="number" value={f.precioVenta} onChange={e=>setF(p=>({...p,precioVenta:e.target.value}))} placeholder="0.00"/>
      </div>

      <Inp label={isNew?'Stock inicial *':'Stock actual *'} type="number" value={f.stock} onChange={e=>setF(p=>({...p,stock:e.target.value}))} placeholder="0"/>

      {margin!==null&&(
        <div style={{background:C.gLight,borderRadius:10,padding:'8px 14px',marginBottom:14,display:'flex',justifyContent:'space-between',fontSize:13}}>
          <span style={{color:C.muted}}>Ganancia por unidad</span>
          <span style={{fontWeight:800,color:C.green}}>{money(+f.precioVenta-+f.precioCompra)} ({margin}%)</span>
        </div>
      )}

      <Btn full onClick={()=>{
        if(!f.nombre||!f.precioCompra||!f.precioVenta||f.stock==='') return;
        onSave({...f,precioCompra:+f.precioCompra,precioVenta:+f.precioVenta,stock:+f.stock,minStock:+(f.minStock||0),id:f.id||uid()});
      }}>{isNew?'Agregar Producto':'Guardar Cambios'}</Btn>
    </Mdl>
  );
}

function Inventario({products,onAdd,onEdit,onDel}){
  const [q,setQ]=useState('');
  const [editP,setEP]=useState(null);
  const [delP,setDP]=useState(null);
  const filtered=products.filter(p=>p.nombre.toLowerCase().includes(q.toLowerCase()));

  return(
    <div style={{paddingBottom:90}}>
      <div style={{background:C.dark,padding:'14px 16px 16px'}}>
        <div style={{color:'#fff',fontWeight:800,fontSize:18,marginBottom:12}}>Inventario</div>
        <div style={{display:'flex',gap:8}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Buscar..." style={{...si,flex:1,background:C.dark2,color:'#fff',border:'none'}}/>
          <button onClick={()=>setEP({})} style={{background:C.green,border:'none',borderRadius:10,padding:'0 16px',color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>+ Nuevo</button>
        </div>
      </div>

      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
        {filtered.length===0
          ?<Card s={{textAlign:'center',color:C.muted,padding:44}}>Sin productos</Card>
          :filtered.map(p=>{
            const margin=p.precioCompra>0?(((p.precioVenta-p.precioCompra)/p.precioCompra)*100).toFixed(0):'—';
            return(
              <Card key={p.id} s={{padding:'12px 14px'}}>
                <div style={{display:'flex',gap:12,alignItems:'center'}}>
                  <PAv foto={p.foto} nombre={p.nombre} size={48}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:15,marginBottom:2}}>{p.nombre}</div>
                    <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{p.unidad} · margen {margin}%</div>
                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                      <span style={{fontSize:11,color:C.muted}}>Compra: {money(p.precioCompra)}</span>
                      <span style={{fontSize:13,fontWeight:800,color:C.green}}>Venta: {money(p.precioVenta)}</span>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
                    <StkBadge stock={p.stock} minStock={p.minStock}/>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>setEP(p)} style={{background:C.bg,border:'none',borderRadius:7,padding:'5px 8px',cursor:'pointer',fontSize:15}}>✏️</button>
                      <button onClick={()=>setDP(p)} style={{background:C.rLight,border:'none',borderRadius:7,padding:'5px 8px',cursor:'pointer',fontSize:15}}>🗑</button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        }
      </div>

      {editP!==null&&(
        <ProdForm product={Object.keys(editP).length===0?null:editP} onClose={()=>setEP(null)}
          onSave={p=>{editP.id?onEdit(p):onAdd(p);setEP(null);}}/>
      )}
      {delP&&(
        <Mdl title="Eliminar producto" onClose={()=>setDP(null)}>
          <p style={{color:C.muted,fontSize:14,marginBottom:20}}>¿Eliminar <strong>{delP.nombre}</strong>? Esta acción no se puede deshacer.</p>
          <div style={{display:'flex',gap:8}}>
            <Btn v="ghost" full onClick={()=>setDP(null)}>Cancelar</Btn>
            <Btn v="danger" full onClick={()=>{onDel(delP.id);setDP(null);}}>Eliminar</Btn>
          </div>
        </Mdl>
      )}
    </div>
  );
}

/* ── HISTORIAL ──────────────────────────────────────────── */
function Historial({sales,onBack}){
  const [date,setDate]=useState(todayStr());
  const [open,setOpen]=useState(null);
  const filtered=[...sales].filter(s=>s.fecha.startsWith(date)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const totRev=filtered.reduce((a,s)=>a+s.total,0);
  const totGan=filtered.reduce((a,s)=>a+s.ganancia,0);

  return(
    <div style={{paddingBottom:90}}>
      <div style={{background:C.dark,padding:'14px 16px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <button onClick={onBack} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:22,padding:'0 4px',lineHeight:1}}>←</button>
          <div style={{color:'#fff',fontWeight:800,fontSize:18}}>Historial</div>
        </div>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...si,background:C.dark2,color:'#fff',border:'none'}}/>
      </div>

      {filtered.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'14px 14px 0'}}>
          <Card s={{textAlign:'center',padding:'12px 8px'}}>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px'}}>Ingresos</div>
            <div style={{fontWeight:900,fontSize:20,color:C.green}}>{money(totRev)}</div>
          </Card>
          <Card s={{textAlign:'center',padding:'12px 8px'}}>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px'}}>Ganancia Bruta</div>
            <div style={{fontWeight:900,fontSize:20,color:C.green}}>{money(totGan)}</div>
          </Card>
        </div>
      )}

      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
        {filtered.length===0
          ?<Card s={{textAlign:'center',color:C.muted,padding:44}}>Sin ventas para esta fecha</Card>
          :filtered.map(s=>(
            <Card key={s.id} s={{padding:'12px 14px',cursor:'pointer'}} onClick={()=>setOpen(open===s.id?null:s.id)}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>🧾 #{s.id.slice(-5).toUpperCase()}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:2}}>{fmtTime(s.fecha)} · {s.items.length} producto{s.items.length!==1?'s':''}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontWeight:900,fontSize:18,color:C.green}}>{money(s.total)}</div>
                  <div style={{fontSize:10,color:C.muted}}>{open===s.id?'▲':'▼'}</div>
                </div>
              </div>
              {open===s.id&&(
                <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10}}>
                  {s.items.map((i,idx)=>(
                    <div key={idx} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'3px 0'}}>
                      <span style={{color:C.muted}}>{i.nombre} × {i.qty} {i.unidad}</span>
                      <span style={{fontWeight:700}}>{money(i.precioVenta*i.qty)}</span>
                    </div>
                  ))}
                  <div style={{borderTop:`1px solid ${C.border}`,marginTop:8,paddingTop:8,display:'flex',justifyContent:'space-between',fontSize:12,color:C.muted}}>
                    <span>Pagado: {money(s.pagado)}</span>
                    <span>Cambio: {money(s.cambio)}</span>
                  </div>
                </div>
              )}
            </Card>
          ))
        }
      </div>
    </div>
  );
}

/* ── FIADO ──────────────────────────────────────────────── */
function FiadoCli({cliente,onClose,onUpdate}){
  const [tab,setTab]=useState('hist');
  const [amt,setAmt]=useState('');
  const [conc,setConc]=useState('');

  const submit=tipo=>{
    const v=parseFloat(amt); if(!v||!conc.trim()) return;
    const mov={id:uid(),fecha:nowIso(),tipo,monto:v,concepto:conc.trim()};
    const nuevaDeuda=tipo==='deuda'?cliente.deuda+v:Math.max(0,cliente.deuda-v);
    onUpdate({...cliente,deuda:nuevaDeuda,movimientos:[mov,...cliente.movimientos]});
    setAmt(''); setConc(''); setTab('hist');
  };

  const TabBtn=({id,l,danger})=>(
    <button onClick={()=>setTab(id)}
      style={{flex:1,border:`2px solid ${tab===id?(danger?C.red:C.green):C.border}`,borderRadius:10,padding:'9px',background:tab===id?(danger?C.rLight:C.gLight):'#fff',fontWeight:700,fontSize:13,cursor:'pointer',color:tab===id?(danger?C.red:C.green):C.muted,fontFamily:'inherit'}}>
      {l}
    </button>
  );

  return(
    <Mdl title={cliente.nombre} onClose={onClose}>
      <div style={{textAlign:'center',marginBottom:16}}>
        <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:4}}>Deuda total</div>
        <div style={{fontSize:38,fontWeight:900,color:cliente.deuda>0?C.red:C.green}}>{money(cliente.deuda)}</div>
        {cliente.deuda===0&&<div style={{color:C.green,fontSize:12,fontWeight:700}}>✓ Cuenta saldada</div>}
      </div>

      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <TabBtn id="hist"   l="Historial"/>
        {cliente.deuda>0&&<TabBtn id="abonar" l="💵 Abonar"/>}
        <TabBtn id="deuda"  l="+ Deuda" danger/>
      </div>

      {tab==='abonar'&&(
        <>
          <Inp label="Monto abonado (CUP)" type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0.00"/>
          <Inp label="Concepto" value={conc} onChange={e=>setConc(e.target.value)} placeholder="ej. Abono parcial"/>
          <Btn full onClick={()=>submit('abono')}>Registrar Abono</Btn>
        </>
      )}
      {tab==='deuda'&&(
        <>
          <Inp label="Monto de deuda (CUP)" type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0.00"/>
          <Inp label="Concepto" value={conc} onChange={e=>setConc(e.target.value)} placeholder="ej. Compra del 2 de julio"/>
          <Btn v="danger" full onClick={()=>submit('deuda')}>Registrar Deuda</Btn>
        </>
      )}
      {tab==='hist'&&(
        <div>
          {cliente.movimientos.length===0
            ?<div style={{textAlign:'center',color:C.muted,padding:24,fontSize:13}}>Sin movimientos</div>
            :cliente.movimientos.map(m=>(
              <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:`1px solid ${C.border}`}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{m.concepto}</div>
                  <div style={{fontSize:11,color:C.muted}}>{fmtDate(m.fecha)} · {fmtTime(m.fecha)}</div>
                </div>
                <span style={{fontWeight:800,color:m.tipo==='abono'?C.green:C.red,fontSize:15}}>
                  {m.tipo==='abono'?'−':'+' }{money(m.monto)}
                </span>
              </div>
            ))
          }
        </div>
      )}
    </Mdl>
  );
}

function Fiado({fiados,onAdd,onUpdate}){
  const [show,setShow]=useState(null);
  const [nom,setNom]=useState('');
  const [amt,setAmt]=useState('');
  const sorted=[...fiados].sort((a,b)=>a.nombre.localeCompare(b.nombre));
  const totalDeuda=fiados.reduce((a,f)=>a+f.deuda,0);

  return(
    <div style={{paddingBottom:90}}>
      <div style={{background:C.dark,padding:'14px 16px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <div style={{color:'#fff',fontWeight:800,fontSize:18}}>Fiado</div>
          <button onClick={()=>setShow('new')} style={{background:C.green,border:'none',borderRadius:10,padding:'8px 14px',color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer'}}>+ Cliente</button>
        </div>
        <div style={{color:C.muted,fontSize:13}}>Total pendiente: <span style={{color:C.red,fontWeight:700}}>{money(totalDeuda)}</span></div>
      </div>

      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
        {sorted.length===0
          ?<Card s={{textAlign:'center',color:C.muted,padding:44}}>Sin clientes con fiado registrado</Card>
          :sorted.map(f=>(
            <Card key={f.id} s={{cursor:'pointer',padding:'12px 14px'}} onClick={()=>setShow(f.id)}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <div style={{width:44,height:44,background:f.deuda>0?C.rLight:C.gLight,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:18,color:f.deuda>0?C.red:C.green,flexShrink:0}}>
                    {f.nombre[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:15}}>{f.nombre}</div>
                    <div style={{fontSize:11,color:C.muted}}>{f.movimientos.length} movimiento{f.movimientos.length!==1?'s':''}</div>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontWeight:900,fontSize:19,color:f.deuda>0?C.red:C.green}}>{money(f.deuda)}</div>
                  {f.deuda===0&&<div style={{fontSize:10,color:C.green,fontWeight:700}}>✓ Saldado</div>}
                </div>
              </div>
            </Card>
          ))
        }
      </div>

      {show==='new'&&(
        <Mdl title="Nuevo Cliente Fiado" onClose={()=>{setShow(null);setNom('');setAmt('');}}>
          <Inp label="Nombre *" value={nom} onChange={e=>setNom(e.target.value)} placeholder="ej. María García"/>
          <Inp label="Deuda inicial (CUP)" type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0.00"/>
          <Btn full onClick={()=>{
            if(!nom.trim()) return;
            const deuda=parseFloat(amt)||0;
            const movs=deuda>0?[{id:uid(),fecha:nowIso(),tipo:'deuda',monto:deuda,concepto:'Deuda inicial'}]:[];
            onAdd({id:uid(),nombre:nom.trim(),deuda,movimientos:movs});
            setShow(null);setNom('');setAmt('');
          }}>Agregar Cliente</Btn>
        </Mdl>
      )}

      {show&&show!=='new'&&(()=>{
        const c=fiados.find(f=>f.id===show);
        if(!c) return null;
        return <FiadoCli cliente={c} onClose={()=>setShow(null)} onUpdate={u=>{onUpdate(u);setShow(null);}}/>;
      })()}
    </div>
  );
}

/* ── ANÁLISIS ───────────────────────────────────────────── */
function Analisis({sales,products,gastos}){
  const [period,setPeriod]=useState('mes');
  const [tab,setTab]=useState('tienda');

  const days=period==='semana'?7:period==='mes'?30:365;
  const cutoff=new Date(Date.now()-days*86400000).toISOString();
  const pSales=sales.filter(s=>s.fecha>=cutoff);

  const ingresos  =pSales.reduce((a,s)=>a+s.total,0);
  const ganBruta  =pSales.reduce((a,s)=>a+s.ganancia,0);
  const numVentas =pSales.length;
  const ticketAvg =numVentas?ingresos/numVentas:0;

  const gastosPeriod=gastos.reduce((tot,g)=>{
    if(g.tipo==='unico') return tot+((!g.fecha||g.fecha>=cutoff.slice(0,10))?g.monto:0);
    const occ=g.frecuencia==='mensual'?Math.ceil(days/30):g.frecuencia==='semanal'?Math.ceil(days/7):0;
    return tot+g.monto*Math.max(occ,0);
  },0);

  const ganReal=ganBruta-gastosPeriod;

  const qMap={},profMap={};
  pSales.forEach(s=>s.items.forEach(i=>{
    qMap[i.productId]=(qMap[i.productId]||0)+i.qty;
    profMap[i.productId]=(profMap[i.productId]||0)+(i.precioVenta-i.precioCompra)*i.qty;
  }));

  const pList=products.map(p=>({...p,qty:qMap[p.id]||0,profit:profMap[p.id]||0}));
  const topQty   =[...pList].sort((a,b)=>b.qty-a.qty).slice(0,5).filter(p=>p.qty>0);
  const topProfit=[...pList].sort((a,b)=>b.profit-a.profit).slice(0,5).filter(p=>p.profit>0);
  const stagnant =pList.filter(p=>{
    const last=[...sales].filter(s=>s.items.some(i=>i.productId===p.id)).sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
    return(!last||daysSince(last.fecha)>=14)&&p.stock>0;
  });

  // Daily chart
  const chartDays=Math.min(days,14);
  const byDay={};
  for(let i=0;i<chartDays;i++){
    const d=new Date(Date.now()-i*86400000).toISOString().slice(0,10);
    byDay[d]=0;
  }
  pSales.forEach(s=>{const d=s.fecha.slice(0,10);if(byDay[d]!==undefined)byDay[d]+=s.total;});
  const chartData=Object.entries(byDay).sort(([a],[b])=>a.localeCompare(b));
  const chartMax=Math.max(...chartData.map(([,v])=>v),1);

  const Chip=({l,v,c=C.text})=>(
    <Card s={{textAlign:'center',padding:'12px 8px'}}>
      <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:'.5px',fontWeight:700,marginBottom:4}}>{l}</div>
      <div style={{fontSize:20,fontWeight:900,color:c,letterSpacing:'-1px'}}>{v}</div>
    </Card>
  );

  return(
    <div style={{paddingBottom:90}}>
      <div style={{background:C.dark,padding:'14px 16px 16px'}}>
        <div style={{color:'#fff',fontWeight:800,fontSize:18,marginBottom:12}}>Análisis</div>
        <div style={{display:'flex',background:C.dark2,borderRadius:12,padding:3,gap:2}}>
          {[['semana','Semana'],['mes','Mes'],['año','Año']].map(([v,l])=>(
            <button key={v} onClick={()=>setPeriod(v)}
              style={{flex:1,border:'none',borderRadius:10,padding:'9px 0',fontWeight:700,fontSize:13,cursor:'pointer',background:period===v?C.green:'transparent',color:period===v?'#fff':'#9CA3AF',fontFamily:'inherit'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,background:C.card}}>
        {[['tienda','📊 Tienda'],['productos','📦 Productos'],['gastos','💸 Gastos']].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)}
            style={{flex:1,border:'none',borderBottom:`3px solid ${tab===v?C.green:'transparent'}`,padding:'12px 4px',fontWeight:700,fontSize:12,cursor:'pointer',background:'transparent',color:tab===v?C.green:C.muted,fontFamily:'inherit'}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{padding:'14px 14px'}}>

        {tab==='tienda'&&(
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              <Chip l="Ingresos"   v={money(ingresos)}    c={C.green}/>
              <Chip l="G. Bruta"   v={money(ganBruta)}    c={C.green}/>
              <Chip l="Gastos"     v={money(gastosPeriod)} c={C.red}/>
              <Chip l="G. Real"    v={money(ganReal)}      c={ganReal>=0?C.green:C.red}/>
              <Chip l="Ventas"     v={String(numVentas)}/>
              <Chip l="Ticket Avg" v={money(ticketAvg)}/>
            </div>
            {pSales.length>0&&(
              <Card s={{marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Ventas diarias</div>
                {chartData.map(([d,v])=>(
                  <div key={d} style={{marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                      <span style={{color:C.muted}}>{fmtDate(d+'T12:00:00')}</span>
                      <span style={{fontWeight:700,color:v>0?C.green:C.muted}}>{money(v)}</span>
                    </div>
                    <Bar value={v} max={chartMax}/>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

        {tab==='productos'&&(
          <>
            <Card s={{marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>🏆 Más Vendidos</div>
              {topQty.length===0
                ?<div style={{color:C.muted,fontSize:13}}>Sin datos en este período</div>
                :topQty.map(p=>(
                  <div key={p.id} style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                      <div style={{display:'flex',gap:7,alignItems:'center'}}>
                        <PAv foto={p.foto} nombre={p.nombre} size={24}/>
                        <span style={{fontSize:13,fontWeight:600}}>{p.nombre}</span>
                      </div>
                      <span style={{fontSize:12,color:C.muted,fontWeight:700}}>{p.qty} {p.unidad}</span>
                    </div>
                    <Bar value={p.qty} max={topQty[0].qty}/>
                  </div>
                ))
              }
            </Card>
            <Card s={{marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>💰 Más Rentables</div>
              {topProfit.length===0
                ?<div style={{color:C.muted,fontSize:13}}>Sin datos en este período</div>
                :topProfit.map(p=>(
                  <div key={p.id} style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                      <div style={{display:'flex',gap:7,alignItems:'center'}}>
                        <PAv foto={p.foto} nombre={p.nombre} size={24}/>
                        <span style={{fontSize:13,fontWeight:600}}>{p.nombre}</span>
                      </div>
                      <span style={{fontSize:12,fontWeight:700,color:C.green}}>{money(p.profit)}</span>
                    </div>
                    <Bar value={p.profit} max={topProfit[0].profit} color={C.green}/>
                  </div>
                ))
              }
            </Card>
            {stagnant.length>0&&(
              <Card>
                <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>📦 Estancados (14+ días)</div>
                {stagnant.slice(0,5).map(p=>(
                  <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <PAv foto={p.foto} nombre={p.nombre} size={28}/>
                      <span style={{fontSize:13,fontWeight:600}}>{p.nombre}</span>
                    </div>
                    <span style={{fontSize:11,color:C.amber,background:C.aLight,padding:'2px 8px',borderRadius:20,fontWeight:700}}>Sin movimiento</span>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

        {tab==='gastos'&&(
          <Card>
            {gastos.length===0
              ?<div style={{textAlign:'center',color:C.muted,padding:40,fontSize:13}}>Sin gastos registrados.<br/>Añade uno desde el ícono 💸 del inicio.</div>
              :gastos.map(g=>(
                <div key={g.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14}}>{g.nombre}</div>
                    <div style={{fontSize:11,color:C.muted}}>{g.categoria} · {g.tipo==='programado'?`🔁 ${g.frecuencia}`:fmtDate(g.fecha||nowIso())}</div>
                  </div>
                  <span style={{fontWeight:800,color:C.red,fontSize:15}}>{money(g.monto)}</span>
                </div>
              ))
            }
            {gastos.length>0&&(
              <div style={{paddingTop:12,display:'flex',justifyContent:'space-between'}}>
                <span style={{fontWeight:700,fontSize:13}}>Impacto en período</span>
                <span style={{fontWeight:900,color:C.red,fontSize:15}}>{money(gastosPeriod)}</span>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── GASTOS PANEL ───────────────────────────────────────── */
function GastosPanel({gastos,onAdd,onDel,onClose}){
  const [form,setForm]=useState(false);
  const [f,setF]=useState({nombre:'',monto:'',categoria:'Otro',tipo:'unico',frecuencia:'mensual',fecha:todayStr()});

  return(
    <Sheet title="💸 Gastos" onClose={onClose}>
      <div style={{padding:'12px 16px'}}>
        {gastos.length===0
          ?<div style={{textAlign:'center',color:C.muted,padding:'20px 0',fontSize:13}}>Sin gastos registrados</div>
          :gastos.map(g=>(
            <div key={g.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{g.nombre}</div>
                <div style={{fontSize:11,color:C.muted}}>{g.categoria} · {g.tipo==='programado'?`🔁 ${g.frecuencia}`:fmtDate(g.fecha||nowIso())}</div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontWeight:800,color:C.red,fontSize:15}}>{money(g.monto)}</span>
                <button onClick={()=>onDel(g.id)} style={{background:C.rLight,border:'none',borderRadius:7,padding:'4px 8px',cursor:'pointer',fontSize:13}}>🗑</button>
              </div>
            </div>
          ))
        }

        {!form
          ?<Btn full style={{marginTop:16}} onClick={()=>setForm(true)}>+ Nuevo Gasto</Btn>
          :(
            <div style={{marginTop:16,padding:14,background:C.bg,borderRadius:14}}>
              <div style={{fontWeight:700,fontSize:15,marginBottom:14,color:C.text}}>Nuevo Gasto</div>
              <Inp label="Nombre *" value={f.nombre} onChange={e=>setF(p=>({...p,nombre:e.target.value}))} placeholder="ej. Salario dependiente"/>
              <Inp label="Monto (CUP) *" type="number" value={f.monto} onChange={e=>setF(p=>({...p,monto:e.target.value}))} placeholder="0.00"/>
              <Sel label="Categoría" value={f.categoria} onChange={e=>setF(p=>({...p,categoria:e.target.value}))}>
                {GASTO_CAT.map(c=><option key={c}>{c}</option>)}
              </Sel>

              <Lbl>Tipo</Lbl>
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                {[['unico','Único'],['programado','Programado']].map(([v,l])=>(
                  <button key={v} onClick={()=>setF(p=>({...p,tipo:v}))}
                    style={{flex:1,border:`2px solid ${f.tipo===v?C.green:C.border}`,borderRadius:10,padding:'10px',background:f.tipo===v?C.gLight:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',color:f.tipo===v?C.green:C.muted,fontFamily:'inherit'}}>
                    {l}
                  </button>
                ))}
              </div>

              {f.tipo==='unico'
                ?<Inp label="Fecha" type="date" value={f.fecha} onChange={e=>setF(p=>({...p,fecha:e.target.value}))}/>
                :<Sel label="Frecuencia" value={f.frecuencia} onChange={e=>setF(p=>({...p,frecuencia:e.target.value}))}>
                  <option value="mensual">Mensual</option>
                  <option value="semanal">Semanal</option>
                </Sel>
              }

              <div style={{display:'flex',gap:8}}>
                <Btn v="ghost" full onClick={()=>setForm(false)}>Cancelar</Btn>
                <Btn full onClick={()=>{
                  if(!f.nombre.trim()||!f.monto) return;
                  onAdd({...f,monto:+f.monto,id:uid()});
                  setF({nombre:'',monto:'',categoria:'Otro',tipo:'unico',frecuencia:'mensual',fecha:todayStr()});
                  setForm(false);
                }}>Guardar</Btn>
              </div>
            </div>
          )
        }
      </div>
    </Sheet>
  );
}

/* ── NOTIFICACIONES PANEL ───────────────────────────────── */
function NotifsPanel({notifs,onDismiss,onClose}){
  return(
    <Sheet title="🔔 Notificaciones" onClose={onClose}>
      <div style={{padding:'12px 16px'}}>
        {notifs.length===0
          ?<div style={{textAlign:'center',color:C.muted,padding:'30px 0',fontSize:13}}>✅ Todo en orden</div>
          :notifs.map(n=>(
            <div key={n.id} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:22,flexShrink:0,marginTop:1}}>{n.ico}</span>
              <span style={{flex:1,fontSize:13,color:C.text,lineHeight:1.5}}>{n.msg}</span>
              <button onClick={()=>onDismiss(n.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:22,flexShrink:0,padding:'0 2px',lineHeight:1}}>×</button>
            </div>
          ))
        }
      </div>
    </Sheet>
  );
}

/* ── CONFIG MODAL ───────────────────────────────────────── */
function ConfigModal({store,onSave,onClose,onReset}){
  const [s,setS]=useState(store);
  const fRef=useRef();

  const handleFile=e=>handleImgFile(e.target.files[0], foto=>setS(p=>({...p,foto})));

  return(
    <Mdl title="⚙️ Mi Tienda" onClose={onClose}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:18}}>
        <div onClick={()=>fRef.current.click()}
          style={{width:80,height:80,background:s.foto?'transparent':C.gLight,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',fontSize:s.foto?0:40,cursor:'pointer',overflow:'hidden',border:`2.5px dashed ${C.green}`,marginBottom:8}}>
          {s.foto?<img src={s.foto} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:STORE_ICONS.find(i=>i.id===s.icon)?.e}
        </div>
        <div style={{display:'flex',gap:12}}>
          <span onClick={()=>fRef.current.click()} style={{color:C.green,fontSize:12,fontWeight:700,cursor:'pointer'}}>📷 Cambiar foto</span>
          {s.foto&&<span onClick={()=>setS(p=>({...p,foto:null}))} style={{color:C.red,fontSize:12,fontWeight:700,cursor:'pointer'}}>× Quitar</span>}
        </div>
        <input ref={fRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile}/>
      </div>

      {!s.foto&&(
        <>
          <Lbl>Tipo de negocio</Lbl>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
            {STORE_ICONS.map(si=>(
              <button key={si.id} onClick={()=>setS(p=>({...p,icon:si.id}))}
                style={{border:`2px solid ${s.icon===si.id?C.green:C.border}`,borderRadius:12,padding:'8px 4px',background:s.icon===si.id?C.gLight:'#fff',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,fontFamily:'inherit'}}>
                <span style={{fontSize:20}}>{si.e}</span>
                <span style={{fontSize:9,color:s.icon===si.id?C.green:C.muted,fontWeight:700}}>{si.l}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <Inp label="Nombre de la tienda" value={s.nombre} onChange={e=>setS(p=>({...p,nombre:e.target.value}))}/>
      <Btn full onClick={()=>onSave(s)}>Guardar Cambios</Btn>

      <div style={{marginTop:24,paddingTop:16,borderTop:`1px solid ${C.border}`,textAlign:'center'}}>
        <div style={{color:C.muted,fontSize:11,marginBottom:12,letterSpacing:'1px'}}>v1.0 · Hecho con ♥ por CuadraTech</div>
        <Btn v="danger" full style={{fontSize:13,padding:'10px'}} onClick={onReset}>⚠️ Borrar todos los datos</Btn>
      </div>
    </Mdl>
  );
}

/* ── HOME ───────────────────────────────────────────────── */
function Home({store,sales,products,notifications,onNotifs,onGastos,onConfig,onHistorial}){
  const t=todayStr();
  const todaySales=sales.filter(s=>s.fecha.startsWith(t));
  const totalCaja=todaySales.reduce((a,s)=>a+s.total,0);
  const clientes=todaySales.length;

  const qMap={};
  todaySales.forEach(s=>s.items.forEach(i=>{qMap[i.productId]=(qMap[i.productId]||0)+i.qty;}));
  const topProds=Object.entries(qMap).sort(([,a],[,b])=>b-a).slice(0,5)
    .map(([id,qty])=>({p:products.find(x=>x.id===id),qty})).filter(({p})=>p);
  const maxQ=topProds[0]?.qty||1;

  const si=STORE_ICONS.find(i=>i.id===store.icon);

  return(
    <div style={{paddingBottom:90}}>
      {/* Header */}
      <div style={{background:C.dark,padding:'14px 16px 20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <button onClick={onConfig} style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:10,padding:0}}>
            <div style={{width:42,height:42,borderRadius:12,overflow:'hidden',flexShrink:0,background:store.foto?'transparent':C.gLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:store.foto?0:22}}>
              {store.foto?<img src={store.foto} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:si?.e}
            </div>
            <div style={{textAlign:'left'}}>
              <div style={{color:'#fff',fontWeight:800,fontSize:16,lineHeight:1.2}}>{store.nombre}</div>
              <div style={{color:C.muted,fontSize:10,letterSpacing:'.5px'}}>CuadraTech</div>
            </div>
          </button>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onGastos} style={{background:C.dark2,border:'none',borderRadius:11,width:40,height:40,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>💸</button>
            <button onClick={onNotifs} style={{background:C.dark2,border:'none',borderRadius:11,width:40,height:40,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
              🔔
              {notifications.length>0&&<span style={{position:'absolute',top:7,right:7,width:8,height:8,background:C.red,borderRadius:'50%',border:`2px solid ${C.dark}`}}/>}
            </button>
          </div>
        </div>
      </div>

      <div style={{padding:'0 14px',marginTop:-8}}>
        {/* Caja — signature element */}
        <Card s={{textAlign:'center',padding:'28px 20px 20px',marginBottom:12}}>
          <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:'2.5px',fontWeight:700,marginBottom:8}}>Caja del Día</div>
          <div style={{fontSize:54,fontWeight:900,color:C.green,letterSpacing:'-3px',lineHeight:1}}>{money(totalCaja)}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:6,letterSpacing:'1px'}}>CUP · {fmtDate(nowIso())}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:18}}>
            <div style={{background:C.bg,borderRadius:10,padding:'10px 6px'}}>
              <div style={{fontWeight:900,fontSize:26,color:C.text}}>{clientes}</div>
              <div style={{fontSize:11,color:C.muted,fontWeight:600}}>Clientes</div>
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:'10px 6px'}}>
              <div style={{fontWeight:900,fontSize:26,color:C.text}}>{todaySales.length}</div>
              <div style={{fontSize:11,color:C.muted,fontWeight:600}}>Ventas</div>
            </div>
          </div>
        </Card>

        {/* Top products */}
        <Card s={{marginBottom:12}}>
          <div style={{fontWeight:800,fontSize:15,marginBottom:14}}>🏆 Más Vendidos Hoy</div>
          {topProds.length===0
            ?<div style={{color:C.muted,textAlign:'center',padding:'18px 0',fontSize:13}}>Sin ventas registradas hoy</div>
            :topProds.map(({p,qty})=>(
              <div key={p.id} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <PAv foto={p.foto} nombre={p.nombre} size={26}/>
                    <span style={{fontSize:13,fontWeight:600}}>{p.nombre}</span>
                  </div>
                  <span style={{fontSize:12,color:C.muted,fontWeight:700}}>{qty} {p.unidad}</span>
                </div>
                <Bar value={qty} max={maxQ}/>
              </div>
            ))
          }
        </Card>

        {/* Historial shortcut */}
        <button onClick={onHistorial}
          style={{width:'100%',background:C.card,border:`1.5px solid ${C.border}`,borderRadius:14,padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',fontFamily:'inherit',boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:18}}>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <span style={{fontSize:20}}>📋</span>
            <span style={{fontWeight:700,fontSize:14,color:C.text}}>Ver historial completo</span>
          </div>
          <span style={{color:C.muted,fontSize:18}}>→</span>
        </button>

        <div style={{textAlign:'center',color:'#D1D5DB',fontSize:10,fontWeight:700,letterSpacing:'3px'}}>CUADRATECH</div>
      </div>
    </div>
  );
}

/* ── MAIN APP ───────────────────────────────────────────── */
export default function App(){
  const [loaded,  setLoaded ]=useState(false);
  const [isFirst, setFirst  ]=useState(false);
  const [store,   setStore  ]=useState({nombre:'Mi Tienda',icon:'general',foto:null});
  const [products,setProds  ]=useState(SEED);
  const [sales,   setSales  ]=useState([]);
  const [fiados,  setFiados ]=useState([]);
  const [gastos,  setGastos ]=useState([]);
  const [dismissed,setDismissed]=useState([]);

  const [tab,     setTab    ]=useState('home');
  const [showSale,setSale   ]=useState(false);
  const [showNotifs,setNotifs]=useState(false);
  const [showGastos,setGastosP]=useState(false);
  const [showConfig,setConfig]=useState(false);
  const [toast,   setToast  ]=useState(null);

  const notifications=useMemo(()=>genNotifs(products,sales,dismissed),[products,sales,dismissed]);

  const showToast=(msg,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3200);};

  /* ── Load from storage ── */
  useEffect(()=>{
    (async()=>{
      try{
        const keys=['ct-store','ct-products','ct-sales','ct-fiados','ct-gastos','ct-dismissed'];
        const res=await Promise.allSettled(keys.map(k=>window.storage.get(k)));
        const get=r=>r.status==='fulfilled'&&r.value?JSON.parse(r.value.value):null;
        const [st,pr,sl,fi,ga,di]=res.map(get);
        if(!st){setFirst(true);}else{setStore(st);}
        if(pr)setProds(pr);
        if(sl)setSales(sl);
        if(fi)setFiados(fi);
        if(ga)setGastos(ga);
        if(di)setDismissed(di);
      }catch(e){setFirst(true);}
      setLoaded(true);
    })();
  },[]);

  /* ── Persist helpers ── */
  const save=async(key,val,setter)=>{setter(val);try{await window.storage.set(key,JSON.stringify(val));}catch(e){}};
  const saveStore   =v=>save('ct-store',v,setStore);
  const saveProds   =v=>save('ct-products',v,setProds);
  const saveSales   =v=>save('ct-sales',v,setSales);
  const saveFiados  =v=>save('ct-fiados',v,setFiados);
  const saveGastos  =v=>save('ct-gastos',v,setGastos);
  const saveDismiss =v=>save('ct-dismissed',v,setDismissed);

  /* ── Sale handler ── */
  const handleSale=async({items,total,pagado,cambio,fecha})=>{
    const ganancia=items.reduce((a,i)=>a+(i.precioVenta-i.precioCompra)*i.qty,0);
    const sale={id:uid(),fecha,items,total,pagado,cambio,ganancia};
    const np=products.map(p=>{const it=items.find(i=>i.productId===p.id);return it?{...p,stock:p.stock-it.qty}:p;});
    await Promise.all([saveSales([sale,...sales]),saveProds(np)]);
    showToast(`✓ Venta registrada · Cambio: ${money(cambio)}`);
  };

  const handleReset=async()=>{
    if(!window.confirm('¿Seguro? Esto borrará TODOS los datos permanentemente.')) return;
    await Promise.all(['ct-store','ct-products','ct-sales','ct-fiados','ct-gastos','ct-dismissed']
      .map(k=>window.storage.delete(k).catch(()=>{})));
    window.location.reload();
  };

  /* ── Loading screen ── */
  if(!loaded) return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:C.dark,flexDirection:'column',gap:16}}>
      <div style={{width:40,height:40,border:`3px solid ${C.green}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin .6s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(isFirst) return <Onboarding onDone={async info=>{await saveStore(info);setFirst(false);}}/>;

  const NAV=[
    {id:'home',      ico:'🏠', l:'Inicio'},
    {id:'inventario',ico:'📦', l:'Inventario'},
    {id:'__fab__',   ico:'',   l:''},
    {id:'fiado',     ico:'🤝', l:'Fiado'},
    {id:'analisis',  ico:'📊', l:'Análisis'},
  ];

  return(
    <div style={{fontFamily:'system-ui,-apple-system,sans-serif',background:C.bg,minHeight:'100vh',maxWidth:480,margin:'0 auto',position:'relative'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        button,input,select{font-family:inherit}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:2px}
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <ToastEl t={toast}/>

      {/* Screens */}
      {tab==='home'       && <Home store={store} sales={sales} products={products} notifications={notifications} onNotifs={()=>setNotifs(true)} onGastos={()=>setGastosP(true)} onConfig={()=>setConfig(true)} onHistorial={()=>setTab('historial')}/>}
      {tab==='inventario' && <Inventario products={products} onAdd={p=>{saveProds([p,...products]);showToast('✓ Producto agregado');}} onEdit={p=>{saveProds(products.map(x=>x.id===p.id?p:x));showToast('✓ Producto actualizado');}} onDel={id=>{saveProds(products.filter(p=>p.id!==id));showToast('Producto eliminado');}}/>}
      {tab==='historial'  && <Historial sales={sales} onBack={()=>setTab('home')}/>}
      {tab==='fiado'      && <Fiado fiados={fiados} onAdd={f=>saveFiados([f,...fiados])} onUpdate={f=>saveFiados(fiados.map(x=>x.id===f.id?f:x))}/>}
      {tab==='analisis'   && <Analisis sales={sales} products={products} gastos={gastos}/>}

      {/* Bottom nav */}
      <nav style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,background:C.dark,display:'flex',alignItems:'center',height:68,zIndex:100,boxShadow:'0 -2px 16px rgba(0,0,0,.2)'}}>
        {NAV.map(n=>{
          if(n.id==='__fab__') return(
            <div key="fab" style={{flex:1,display:'flex',justifyContent:'center',alignItems:'center'}}>
              <button onClick={()=>setSale(true)}
                style={{width:56,height:56,borderRadius:'50%',background:C.green,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 4px 18px rgba(0,204,150,.45)`,marginBottom:18,flexShrink:0}}>
                <span style={{color:'#fff',fontSize:30,fontWeight:300,lineHeight:1,marginTop:-2}}>+</span>
              </button>
            </div>
          );
          const active=tab===n.id||(tab==='historial'&&n.id==='home');
          return(
            <button key={n.id} onClick={()=>setTab(n.id)}
              style={{flex:1,background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'8px 0',position:'relative'}}>
              <span style={{fontSize:20,opacity:active?1:.4}}>{n.ico}</span>
              <span style={{fontSize:9,fontWeight:700,color:active?C.green:'#6B7280',letterSpacing:'.3px',textTransform:'uppercase'}}>{n.l}</span>
              {active&&<div style={{position:'absolute',bottom:4,width:4,height:4,borderRadius:'50%',background:C.green}}/>}
            </button>
          );
        })}
      </nav>

      {/* Overlays */}
      {showSale    && <NuevaVenta products={products} onClose={()=>setSale(false)} onConfirm={handleSale}/>}
      {showNotifs  && <NotifsPanel notifs={notifications} onDismiss={id=>saveDismiss([...dismissed,id])} onClose={()=>setNotifs(false)}/>}
      {showGastos  && <GastosPanel gastos={gastos} onAdd={g=>saveGastos([g,...gastos])} onDel={id=>saveGastos(gastos.filter(g=>g.id!==id))} onClose={()=>setGastosP(false)}/>}
      {showConfig  && <ConfigModal store={store} onSave={s=>{saveStore(s);setConfig(false);showToast('✓ Tienda actualizada');}} onClose={()=>setConfig(false)} onReset={handleReset}/>}
    </div>
  );
}
