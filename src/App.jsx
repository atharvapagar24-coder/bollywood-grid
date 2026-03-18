import { useState, useEffect, useRef } from "react";

const BOLLYWOOD_LETTERS = ["B","O","L","L","Y","W","O","O","D"];
const QUICK_REACTIONS = ["🔥","💀","😂","👏","😭","🎬"];
const TAUNTS = [
  "😂 Is that your best guess?",
  "💀 My nani knows more Bollywood!",
  "🎬 Wrong! Back to school!",
  "😈 Oops! Try again loser!",
  "🔥 Seriously? THAT answer?",
  "🤡 Are you even trying?",
  "😭 That was painful to watch",
  "🪦 RIP your Bollywood knowledge",
  "🧠 Did you even watch Bollywood?",
  "👀 Are you guessing or joking?",
  "🎭 Even my cat knows this one!",
  "💅 Honey... no.",
];
const BRUSH_COLORS = ["#ff4d8d","#ffffff","#ff6b35","#ffd700","#00f5a0","#a78bfa"];

// ─── Sound Engine ─────────────────────────────────────────────────────────────
function createSFX() {
  let ctx = null;
  const ac = () => { if (!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)(); return ctx; };
  const p = (fn) => { try { fn(ac()); } catch(e){} };
  return {
    correct: () => p(c => {
      [523,659,784].forEach((f,i) => {
        const o=c.createOscillator(),g=c.createGain();
        o.connect(g);g.connect(c.destination);
        o.frequency.value=f;g.gain.setValueAtTime(0.25,c.currentTime+i*0.1);
        g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+i*0.1+0.35);
        o.start(c.currentTime+i*0.1);o.stop(c.currentTime+i*0.1+0.35);
      });
    }),
    wrong: () => p(c => {
      const o=c.createOscillator(),g=c.createGain();
      o.connect(g);g.connect(c.destination);o.type="sawtooth";
      o.frequency.setValueAtTime(200,c.currentTime);o.frequency.setValueAtTime(130,c.currentTime+0.2);
      g.gain.setValueAtTime(0.3,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.4);
      o.start();o.stop(c.currentTime+0.4);
    }),
    coin: () => p(c => {
      [0,0.06,0.14,0.24,0.36].forEach((t,i) => {
        const o=c.createOscillator(),g=c.createGain();
        o.connect(g);g.connect(c.destination);o.frequency.value=1400-i*100;
        g.gain.setValueAtTime(0.12,c.currentTime+t);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+t+0.12);
        o.start(c.currentTime+t);o.stop(c.currentTime+t+0.12);
      });
    }),
    win: () => p(c => {
      [523,659,784,1047].forEach((f,i) => {
        const o=c.createOscillator(),g=c.createGain();
        o.connect(g);g.connect(c.destination);o.frequency.value=f;
        g.gain.setValueAtTime(0.22,c.currentTime+i*0.13);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+i*0.13+0.45);
        o.start(c.currentTime+i*0.13);o.stop(c.currentTime+i*0.13+0.45);
      });
    }),
    lose: () => p(c => {
      [400,320,240,160].forEach((f,i) => {
        const o=c.createOscillator(),g=c.createGain();
        o.connect(g);g.connect(c.destination);o.type="triangle";o.frequency.value=f;
        g.gain.setValueAtTime(0.2,c.currentTime+i*0.16);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+i*0.16+0.4);
        o.start(c.currentTime+i*0.16);o.stop(c.currentTime+i*0.16+0.4);
      });
    }),
    taunt: () => p(c => {
      const o=c.createOscillator(),g=c.createGain();
      o.connect(g);g.connect(c.destination);o.type="square";
      o.frequency.setValueAtTime(320,c.currentTime);o.frequency.setValueAtTime(260,c.currentTime+0.1);o.frequency.setValueAtTime(320,c.currentTime+0.2);
      g.gain.setValueAtTime(0.12,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.35);
      o.start();o.stop(c.currentTime+0.35);
    }),
    tap: () => p(c => {
      const o=c.createOscillator(),g=c.createGain();
      o.connect(g);g.connect(c.destination);o.frequency.value=900;
      g.gain.setValueAtTime(0.06,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.07);
      o.start();o.stop(c.currentTime+0.07);
    }),
  };
}
const SFX = createSFX();

// ─── Storage ──────────────────────────────────────────────────────────────────
const ls = {
  get:(k,d=null)=>{ try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;} },
  set:(k,v)=>{ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){} },
};
const saveRoom=(c,d)=>ls.set("bgr_"+c,{...d,ts:Date.now()});
const loadRoom=(c)=>{ const d=ls.get("bgr_"+c); return d&&(Date.now()-d.ts<3600000)?d:null; };
const getLB=()=>ls.get("bg_lb",[]);
const saveLB=(lb)=>ls.set("bg_lb",lb);
const addToLB=(name,won)=>{ const lb=getLB(); const e=lb.find(x=>x.name===name); if(e){e.wins+=won?1:0;e.games+=1;}else{lb.push({name,wins:won?1:0,games:1});} lb.sort((a,b)=>(b.wins*10+b.games)-(a.wins*10+a.games)); saveLB(lb.slice(0,50)); };

// ─── AI ───────────────────────────────────────────────────────────────────────
async function fetchRound() {
  const themes=["2000s Bollywood blockbusters","2010s romantic hits","Shah Rukh Khan movies 2000s","2020s Bollywood","Karan Johar films 2000+","Salman Khan films 2000+","Action Bollywood 2010s","Ranveer Singh era","Aamir Khan films 2000+","Hrithik Roshan films 2000+"];
  const theme=themes[Math.floor(Math.random()*themes.length)];
  const res=await fetch("/api/generate",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:200,messages:[{role:"user",content:`Bollywood quiz round. Theme: ${theme}. RULES: movie & song must be 2000 or later. Real famous names only. Return ONLY JSON: {"actor":"Name","actress":"Name","movie":"Name (year)","song":"Name"}`}]})
  });
  const data=await res.json();
  const text=data.content.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();
  return JSON.parse(text);
}

// ─── Coin SVGs ────────────────────────────────────────────────────────────────
const CoinHeads=()=>(
  <svg viewBox="0 0 120 120" width="120" height="120">
    <defs><radialGradient id="hg" cx="40%" cy="35%"><stop offset="0%" stopColor="#ffe066"/><stop offset="100%" stopColor="#b8860b"/></radialGradient></defs>
    <circle cx="60" cy="60" r="58" fill="#8b6914" stroke="#ffd700" strokeWidth="2"/>
    <circle cx="60" cy="60" r="52" fill="url(#hg)"/>
    <circle cx="60" cy="60" r="44" fill="none" stroke="#b8860b" strokeWidth="2"/>
    {/* Face profile */}
    <ellipse cx="60" cy="48" rx="13" ry="15" fill="#b8860b"/>
    <ellipse cx="60" cy="72" rx="20" ry="12" fill="#b8860b"/>
    <circle cx="60" cy="33" r="4" fill="#b8860b"/>
    <text x="60" y="100" textAnchor="middle" fill="#7a5500" fontSize="9" fontWeight="900" fontFamily="serif" letterSpacing="2">HEADS</text>
  </svg>
);
const CoinTails=()=>(
  <svg viewBox="0 0 120 120" width="120" height="120">
    <defs><radialGradient id="tg" cx="40%" cy="35%"><stop offset="0%" stopColor="#ffd700"/><stop offset="100%" stopColor="#8b6914"/></radialGradient></defs>
    <circle cx="60" cy="60" r="58" fill="#6b4f00" stroke="#ffd700" strokeWidth="2"/>
    <circle cx="60" cy="60" r="52" fill="url(#tg)"/>
    <circle cx="60" cy="60" r="44" fill="none" stroke="#daa520" strokeWidth="2"/>
    <text x="60" y="72" textAnchor="middle" fill="#5a3e00" fontSize="40" fontWeight="900" fontFamily="Georgia,serif">₹</text>
    <text x="60" y="100" textAnchor="middle" fill="#5a3e00" fontSize="9" fontWeight="900" fontFamily="serif" letterSpacing="2">TAILS</text>
    {[0,45,90,135,180,225,270,315].map((a,i)=>{
      const r=48,x=60+r*Math.cos(a*Math.PI/180),y=60+r*Math.sin(a*Math.PI/180);
      return <circle key={i} cx={x} cy={y} r="2.5" fill="#ffd70077"/>;
    })}
  </svg>
);

// ─── App Logo ─────────────────────────────────────────────────────────────────
const Logo=({size=80})=>(
  <svg viewBox="0 0 200 200" width={size} height={size} style={{borderRadius:size*0.22,display:"block"}}>
    <defs>
      <radialGradient id="lbg" cx="50%" cy="50%" r="70%"><stop offset="0%" stopColor="#2d0a45"/><stop offset="100%" stopColor="#08050f"/></radialGradient>
      <radialGradient id="lglow" cx="50%" cy="30%" r="60%"><stop offset="0%" stopColor="#9b2d6688"/><stop offset="100%" stopColor="transparent"/></radialGradient>
    </defs>
    <rect width="200" height="200" rx="44" fill="url(#lbg)" stroke="#ffd70033" strokeWidth="2"/>
    <rect width="200" height="200" rx="44" fill="url(#lglow)"/>
    <line x1="100" y1="28" x2="100" y2="172" stroke="#ffd700" strokeWidth="1.5" opacity="0.7"/>
    <line x1="28" y1="100" x2="172" y2="100" stroke="#ffd700" strokeWidth="1.5" opacity="0.7"/>
    {/* Clapperboard */}
    <rect x="36" y="40" width="48" height="36" rx="5" fill="#ffd700" opacity="0.95"/>
    <rect x="36" y="40" width="48" height="11" rx="3" fill="#a07000"/>
    {[0,8,16,24,32,40].map(x=><line key={x} x1={36+x} y1="40" x2={36+x+8} y2="51" stroke="#08050f" strokeWidth="1.8"/>)}
    {/* Music note */}
    <text x="118" y="88" fontSize="44" fill="#ffd700" opacity="0.9" fontFamily="serif">♪</text>
    {/* Female silhouette */}
    <ellipse cx="66" cy="130" rx="11" ry="13" fill="#ffd700" opacity="0.9"/>
    <path d="M46 160 Q66 143 86 160" fill="#ffd700" opacity="0.9"/>
    {/* Male silhouette */}
    <ellipse cx="134" cy="128" rx="12" ry="14" fill="#ffd700" opacity="0.85"/>
    <path d="M114 160 Q134 141 154 160" fill="#ffd700" opacity="0.85"/>
    <circle cx="100" cy="100" r="5" fill="#ffd700" opacity="0.8"/>
    <circle cx="100" cy="100" r="14" fill="#ffd70015"/>
  </svg>
);

// ─── Matchmaking Component ────────────────────────────────────────────────────
// Uses localStorage as a simple "server" — players write themselves to a queue,
// first two get matched into a shared room code.
function Matchmaking({myName, onMatch, onBack}) {
  const [status, setStatus] = useState("searching"); // searching | found | waiting
  const [dots, setDots] = useState(".");
  const [matchName, setMatchName] = useState("");
  const pollRef = useRef(null);
  const myKey = useRef("bgmq_"+myName+"_"+Date.now());

  useEffect(()=>{
    const di = setInterval(()=>setDots(d=>d.length>=3?".":d+"."),500);
    return()=>clearInterval(di);
  },[]);

  useEffect(()=>{
    // Write myself to the queue
    const entry = {name:myName, key:myKey.current, ts:Date.now()};
    try{ localStorage.setItem(myKey.current, JSON.stringify(entry)); }catch(e){}

    pollRef.current = setInterval(()=>{
      try{
        // Gather all queue entries in last 30s
        const queue = [];
        for(let i=0;i<localStorage.length;i++){
          const k=localStorage.key(i);
          if(!k||!k.startsWith("bgmq_"))continue;
          const v=localStorage.getItem(k);
          if(!v)continue;
          const e=JSON.parse(v);
          if(Date.now()-e.ts>30000){localStorage.removeItem(k);continue;}
          queue.push(e);
        }
        queue.sort((a,b)=>a.ts-b.ts);

        if(queue.length>=2){
          const me = queue.find(e=>e.key===myKey.current);
          if(!me)return;
          const idx = queue.indexOf(me);
          const partner = idx===0?queue[1]:queue[0];

          // Generate deterministic room code from first player's key
          const roomCode = queue[0].key.split("_").pop().substring(0,5).toUpperCase();
          const isHost = idx===0;

          // Save room
          if(isHost){
            const existing = JSON.parse(localStorage.getItem("bgr_"+roomCode)||"null");
            if(!existing){
              localStorage.setItem("bgr_"+roomCode, JSON.stringify({round:null,messages:[{from:"system",text:`🌍 Matched with ${partner.name}!`}],ts:Date.now()}));
            }
          }

          // Clean up queue entry
          localStorage.removeItem(myKey.current);
          clearInterval(pollRef.current);
          setMatchName(partner.name);
          setStatus("found");
          setTimeout(()=>onMatch(roomCode, isHost), 1500);
        }
      }catch(e){}
    }, 1500);

    return()=>{
      clearInterval(pollRef.current);
      try{localStorage.removeItem(myKey.current);}catch(e){}
    };
  },[]);

  const cancel = ()=>{
    clearInterval(pollRef.current);
    try{localStorage.removeItem(myKey.current);}catch(e){}
    onBack();
  };

  return(
    <div style={s.page}><style>{css}</style>
    <div style={s.center}>
      <div style={{...s.lt,fontSize:26}}>BOLLYWOOD</div>
      <div style={s.ls}>G R I D</div>
      <div style={{...{fontSize:12,letterSpacing:3,color:"#ffd700",fontWeight:700},marginTop:32}}>
        🌍 MATCHMAKING
      </div>
      {status==="searching"&&<>
        <div style={{fontSize:72,margin:"24px 0",animation:"pulse 1s infinite"}}>🔍</div>
        <div style={{fontSize:16,fontWeight:700,color:"#ffffff88",marginBottom:8}}>
          Finding opponent{dots}
        </div>
        <div style={{fontSize:12,color:"#ffffff44",marginBottom:32,textAlign:"center"}}>
          Looking for Bollywood fans to challenge!
        </div>
        <div style={{background:"#ffffff08",borderRadius:12,padding:"12px 20px",marginBottom:24,width:"100%",maxWidth:280}}>
          <div style={{fontSize:10,letterSpacing:2,color:"#ffffff44",marginBottom:4}}>YOUR NAME</div>
          <div style={{fontSize:16,fontWeight:700,color:"#ff4d8d"}}>{myName}</div>
        </div>
        <button style={{background:"transparent",border:"1px solid #ffffff22",borderRadius:50,padding:"10px 24px",color:"#ffffff55",fontSize:13,cursor:"pointer"}} onClick={cancel}>Cancel</button>
      </>}
      {status==="found"&&<>
        <div style={{fontSize:72,margin:"24px 0"}}>🎉</div>
        <div style={{fontSize:18,fontWeight:700,color:"#00f5a0",marginBottom:8}}>Match Found!</div>
        <div style={{fontSize:14,color:"#ffffff88"}}>vs <span style={{color:"#ff4d8d",fontWeight:700}}>{matchName}</span></div>
        <div style={{fontSize:12,color:"#ffffff44",marginTop:8}}>Starting game...</div>
      </>}
    </div></div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BollywoodGrid() {
  const [screen,setScreen]=useState("splash");
  const [gameMode,setGameMode]=useState(null);
  const [round,setRound]=useState(null);
  const [loading,setLoading]=useState(false);
  const [lives,setLives]=useState(9);
  const [solved,setSolved]=useState({actor:false,actress:false,movie:false,song:false});
  const [currentField,setCurrentField]=useState("actor");
  const [inputVal,setInputVal]=useState("");
  const [chatMsgs,setChatMsgs]=useState([]);
  const [chatInput,setChatInput]=useState("");
  const [showChat,setShowChat]=useState(false);
  const [showTaunt,setShowTaunt]=useState(null);
  const [showTauntPicker,setShowTauntPicker]=useState(false);
  const [coinResult,setCoinResult]=useState(null);
  const [coinFlipping,setCoinFlipping]=useState(false);
  const [isGuesser,setIsGuesser]=useState(true);
  const [roomCode,setRoomCode]=useState("");
  const [joinCode,setJoinCode]=useState("");
  const [roomError,setRoomError]=useState("");
  const [hostData,setHostData]=useState({actor:"",actress:"",movie:"",song:""});
  const [unread,setUnread]=useState(0);
  const [wrongShake,setWrongShake]=useState(false);
  const [fworks,setFworks]=useState([]);
  const [brushColor,setBrushColor]=useState("#ff4d8d");
  const [myName,setMyName]=useState(()=>ls.get("bg_profile",{name:""}).name||"");
  const [nameInput,setNameInput]=useState("");
  const [showLB,setShowLB]=useState(false);
  const [lb,setLb]=useState([]);
  const [friends,setFriends]=useState(()=>ls.get("bg_friends",[]));
  const [showFriendAdd,setShowFriendAdd]=useState(false);
  const [oppName,setOppName]=useState("");
  const canvasRef=useRef(null);
  const ctxRef=useRef(null);
  const drawing=useRef(false);
  const lastPos=useRef(null);
  const brushRef=useRef(brushColor);
  const chatEnd=useRef(null);

  useEffect(()=>{brushRef.current=brushColor;},[brushColor]);
  useEffect(()=>{ if(screen==="splash"){const t=setTimeout(()=>setScreen(myName?"home":"onboard"),2600);return()=>clearTimeout(t);} },[screen]);
  useEffect(()=>{ const h=e=>{e.preventDefault();window._dp=e;}; window.addEventListener("beforeinstallprompt",h); return()=>window.removeEventListener("beforeinstallprompt",h); },[]);
  useEffect(()=>{ chatEnd.current?.scrollIntoView({behavior:"smooth"}); },[chatMsgs]);

  // Canvas — init once per game screen mount, brush color via ref
  useEffect(()=>{
    if(screen!=="game") return;
    const canvas=canvasRef.current; if(!canvas) return;
    canvas.width=canvas.offsetWidth||300; canvas.height=canvas.offsetHeight||160;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#0d0d0d"; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctxRef.current=ctx;
    const gp=e=>{const r=canvas.getBoundingClientRect(),s=e.touches?e.touches[0]:e;return{x:s.clientX-r.left,y:s.clientY-r.top};};
    const os=e=>{e.preventDefault();drawing.current=true;lastPos.current=gp(e);};
    const om=e=>{
      e.preventDefault();if(!drawing.current||!ctxRef.current)return;
      const p=gp(e),c=ctxRef.current;
      c.beginPath();c.moveTo(lastPos.current.x,lastPos.current.y);c.lineTo(p.x,p.y);
      c.globalCompositeOperation="source-over";
      if(brushRef.current==="eraser"){c.strokeStyle="#0d0d0d";c.lineWidth=24;}else{c.strokeStyle=brushRef.current;c.lineWidth=4;}
      c.lineCap="round";c.lineJoin="round";c.stroke();
      lastPos.current=p;
    };
    const oe=()=>{drawing.current=false;lastPos.current=null;};
    canvas.addEventListener("mousedown",os);canvas.addEventListener("mousemove",om);canvas.addEventListener("mouseup",oe);canvas.addEventListener("mouseleave",oe);
    canvas.addEventListener("touchstart",os,{passive:false});canvas.addEventListener("touchmove",om,{passive:false});canvas.addEventListener("touchend",oe);
    return()=>{canvas.removeEventListener("mousedown",os);canvas.removeEventListener("mousemove",om);canvas.removeEventListener("mouseup",oe);canvas.removeEventListener("mouseleave",oe);canvas.removeEventListener("touchstart",os);canvas.removeEventListener("touchmove",om);canvas.removeEventListener("touchend",oe);};
  },[screen]);

  const addChat=(from,text)=>{ setChatMsgs(p=>[...p,{from,text,id:Date.now()}]); if(!showChat)setUnread(c=>c+1); };

  // ── Fuzzy matching helpers ──────────────────────────────────────────────────
  const norm=(s)=>s.toLowerCase().replace(/[^a-z0-9\s]/g,"").replace(/\s+/g," ").trim();

  // Levenshtein distance — counts how many edits needed to match
  const lev=(a,b)=>{
    const m=a.length,n=b.length;
    const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0));
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
    return dp[m][n];
  };

  // Check if guess is close enough to answer
  const isFuzzyMatch=(guess,answer)=>{
    const g=norm(guess), a=norm(answer.replace(/\(.*\)/g,""));
    if(!g||!a) return false;

    // 1. Exact match
    if(g===a) return true;

    // 2. Answer contains guess (first name match — e.g. "deepika" for "deepika padukone")
    if(a.includes(g)&&g.length>=4) return true;

    // 3. Guess contains answer (overly verbose guess)
    if(g.includes(a)&&a.length>=4) return true;

    // 4. Levenshtein fuzzy — allow 1 typo per 5 chars
    const maxDist=Math.floor(Math.max(g.length,a.length)/5)+1;
    if(lev(g,a)<=maxDist) return true;

    // 5. Word-level matching — all words of guess match words of answer fuzzily
    const gWords=g.split(" "), aWords=a.split(" ");
    const allMatch=gWords.every(gw=>aWords.some(aw=>lev(gw,aw)<=1||(aw.includes(gw)&&gw.length>=3)));
    if(allMatch&&gWords.length>=1&&gWords[0].length>=3) return true;

    // 6. Remove spaces — "shahrukh" → "shah rukh"
    if(g.replace(/\s/g,"")=== a.replace(/\s/g,"")) return true;
    if(lev(g.replace(/\s/g,""),a.replace(/\s/g,""))<=2) return true;

    return false;
  };

  const startBot=async()=>{
    setLoading(true);
    try{
      const data=await fetchRound();
      setRound(data);setLives(9);setSolved({actor:false,actress:false,movie:false,song:false});
      setCurrentField("actor");setInputVal("");setChatMsgs([{from:"bot",text:"🎬 Answers locked! Good luck 😈"}]);
      setIsGuesser(true);setGameMode("bot");setFworks([]);setScreen("game");
    }catch(e){alert("Couldn't load round. Check connection!");}
    setLoading(false);
  };

  const submitGuess=()=>{
    if(!inputVal.trim()||!isGuesser||!round)return;
    const ans=round[currentField];
    const ok=isFuzzyMatch(inputVal,ans);
    if(ok){
      SFX.correct();const ns={...solved,[currentField]:true};setSolved(ns);setInputVal("");
      addChat("system",`✅ ${currentField.toUpperCase()}: ${ans}`);
      const next=["actor","actress","movie","song"].find(f=>!ns[f]);
      if(!next){setTimeout(()=>{SFX.win();launchFW();addToLB(myName,true);setTimeout(()=>setScreen("win"),1800);},300);}
      else setCurrentField(next);
    }else{
      SFX.wrong();const nl=lives-1;setLives(nl);setWrongShake(true);setTimeout(()=>setWrongShake(false),600);
      addChat("system",`❌ Wrong! ${nl} lives left`);setInputVal("");
      if(nl<=0){setTimeout(()=>{SFX.lose();addToLB(myName,false);setScreen("lose");},800);}
    }
  };

  const launchFW=()=>{
    const cols=["#ff4d8d","#ffd700","#ff6b35","#00f5a0","#a855f7","#38bdf8"];
    setFworks(Array.from({length:24},(_,i)=>({id:i,x:Math.random()*100,y:Math.random()*65,color:cols[i%6],size:Math.random()*14+6,delay:Math.random()*1.2})));
    setTimeout(()=>setFworks([]),3500);
  };

  const clearCanvas=()=>{ const c=canvasRef.current;if(c&&ctxRef.current){ctxRef.current.fillStyle="#0d0d0d";ctxRef.current.fillRect(0,0,c.width,c.height);} };
  const sendTaunt=t=>{SFX.taunt();setShowTaunt(t);addChat("me",t);setShowTauntPicker(false);setTimeout(()=>setShowTaunt(null),2800);};
  const sendChat=()=>{ if(!chatInput.trim())return;SFX.tap();addChat("me",chatInput);setChatInput(""); };
  const tap=()=>SFX.tap();

  const flipCoin=()=>{
    SFX.coin();setCoinFlipping(true);
    setTimeout(()=>{const r=Math.random()>"0.5"?"heads":"tails";setCoinResult(r);setCoinFlipping(false);setIsGuesser(r==="heads");},1800);
  };

  const afterCoin=async()=>{
    tap();
    if(gameMode==="bot"){await startBot();return;}
    if(isGuesser){
      setLoading(true);const room=loadRoom(roomCode);
      if(room?.round){setRound(room.round);setLives(9);setSolved({actor:false,actress:false,movie:false,song:false});setCurrentField("actor");setInputVal("");setChatMsgs([{from:"system",text:"🎯 You're guessing!"}]);setScreen("game");}
      else alert("Room not ready yet!");
      setLoading(false);
    }else setScreen("host-setup");
  };

  const createRoom=()=>{ tap();const c=Math.random().toString(36).substring(2,7).toUpperCase();setRoomCode(c);saveRoom(c,{round:null,messages:[],ts:Date.now()});setGameMode("friend-host");setScreen("create-room"); };
  const confirmJoin=()=>{ tap();const room=loadRoom(joinCode.toUpperCase());if(!room){setRoomError("Room not found!");return;}setRoomCode(joinCode.toUpperCase());setGameMode("friend-join");setCoinResult(null);setCoinFlipping(false);setScreen("coinflip"); };
  const submitHost=()=>{
    if(!hostData.actor||!hostData.actress||!hostData.movie||!hostData.song){alert("Fill all 4!");return;}
    tap();saveRoom(roomCode,{round:hostData,messages:[],ts:Date.now()});setRound(hostData);setIsGuesser(false);setLives(9);setSolved({actor:false,actress:false,movie:false,song:false});setChatMsgs([{from:"system",text:"✍️ Answers set! Waiting for opponent..."}]);setScreen("game");
  };
  const saveName=()=>{ if(!nameInput.trim())return;const n=nameInput.trim();setMyName(n);ls.set("bg_profile",{name:n});setScreen("home"); };
  const addFriend=n=>{ const f=[...friends,{name:n,since:Date.now()}];setFriends(f);ls.set("bg_friends",f);setShowFriendAdd(false);setOppName(""); };
  const promptInstall=()=>{ if(window._dp)window._dp.prompt();else alert("📲 iOS: Share → Add to Home Screen\nAndroid: ⋮ → Add to Home Screen"); };

  const fields=["actor","actress","movie","song"];
  const FW=()=>fworks.map(fw=><div key={fw.id} style={{position:"fixed",left:`${fw.x}%`,top:`${fw.y}%`,width:fw.size,height:fw.size,borderRadius:"50%",background:fw.color,zIndex:1000,pointerEvents:"none",animation:`fw 1s ease-out ${fw.delay}s both`}}/>);

  // SCREENS
  if(screen==="splash") return <div style={s.splash}><style>{css}</style><div style={s.sGlow}/><div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:900,fontSize:42,letterSpacing:12,color:"#ff4d8d",textShadow:"0 0 40px #ff4d8d88",animation:"fadeUp 1s .2s both"}}>BOLLYWOOD</div><div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:300,fontSize:18,letterSpacing:16,color:"#ffd700",marginTop:8,animation:"fadeUp 1s .5s both"}}>G R I D</div><div style={s.dots}>{[0,.3,.6].map((d,i)=><span key={i} style={{...s.dot,animationDelay:`${d}s`}}/>)}</div></div>;

  if(screen==="onboard") return <div style={s.page}><style>{css}</style><div style={s.center}><div style={{...s.lt,fontSize:28}}>BOLLYWOOD</div><div style={s.ls}>G R I D</div><div style={{...s.tag,marginTop:28}}>🎬 YOUR NAME?</div><div style={s.hint}>Shows on the leaderboard!</div><input style={s.ci} placeholder="Enter name..." value={nameInput} onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveName()} maxLength={16}/><button style={s.bp} onClick={saveName}>Let's Play! 🎬</button></div></div>;

  if(screen==="home") return (
    <div style={s.page}><style>{css}</style>
    <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 10%,#ff4d8d18 0%,transparent 60%)",pointerEvents:"none"}}/>
    <div style={{...s.center,position:"relative",zIndex:1}}>
      <div style={s.lt}>BOLLYWOOD</div><div style={s.ls}>G R I D</div>
      <div style={{fontSize:12,color:"#ffd70077",marginTop:6}}>Hey {myName}! 👋</div>
      <div style={{display:"flex",flexDirection:"column",gap:14,width:"100%",maxWidth:280,marginTop:28}}>
        <button style={s.bp} onClick={()=>{tap();setGameMode("bot");setCoinResult(null);setCoinFlipping(false);setScreen("coinflip");}}>🤖 Play vs Bot</button>
        <button style={{...s.bp,background:"linear-gradient(135deg,#a855f7,#7c3aed)"}} onClick={()=>{tap();setScreen("matchmaking");}}>🌍 Play with Strangers</button>
        <button style={s.bs} onClick={createRoom}>🎮 Create Room</button>
        <button style={s.bo} onClick={()=>{tap();setScreen("join-room");}}>🔗 Join Room</button>
      </div>
      <div style={{display:"flex",gap:18,marginTop:28}}>
        <button style={s.ib} onClick={()=>{setLb(getLB());setShowLB(true);}}>🏆</button>
        <button style={s.ib} onClick={()=>setScreen("friends")}>👥</button>
        <button style={s.ib} onClick={promptInstall}>📲</button>
      </div>
      <div style={{fontSize:10,letterSpacing:3,color:"#ff4d8d55",marginTop:10}}>💀 B-O-L-L-Y-W-O-O-D Lives</div>
    </div>
    {showLB&&<div style={s.overlay}><div style={s.mb}><div style={s.mh}><span style={{color:"#ffd700",fontWeight:700,letterSpacing:2}}>🏆 LEADERBOARD</span><button style={s.xb} onClick={()=>setShowLB(false)}>✕</button></div><div style={{overflowY:"auto",maxHeight:340,padding:"4px 0"}}>{lb.length===0?<div style={{color:"#ffffff44",textAlign:"center",padding:32,fontSize:13}}>No games yet!</div>:lb.map((e,i)=><div key={i} style={s.lbr}><span style={{...s.lbrank,color:i===0?"#ffd700":i===1?"#aaa":i===2?"#cd7f32":"#555"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span><span style={{flex:1,fontSize:14}}>{e.name}</span><span style={{fontSize:12,color:"#ffd700",fontWeight:700}}>{e.wins}W/{e.games}G</span></div>)}</div></div></div>}
    </div>
  );

  if(screen==="friends") return (
    <div style={s.page}><style>{css}</style>
    <div style={{...s.center,justifyContent:"flex-start",paddingTop:52}}>
      <div style={{...s.lt,fontSize:22}}>👥 FRIENDS</div>
      <div style={{...s.hint,marginBottom:20}}>Add friends to track when they play!</div>
      {friends.length===0?<div style={{color:"#ffffff33",fontSize:13,marginBottom:20}}>No friends yet!</div>:<div style={{width:"100%",marginBottom:16}}>{friends.map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0",borderBottom:"1px solid #ffffff08"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#44ff88"}}/><span style={{flex:1,fontSize:14}}>{f.name}</span></div>)}</div>}
      {showFriendAdd?<div style={{width:"100%",display:"flex",flexDirection:"column",gap:10}}><input style={{...s.ci,fontSize:16,letterSpacing:1}} placeholder="Friend's name..." value={oppName} onChange={e=>setOppName(e.target.value)} maxLength={16}/><button style={s.bp} onClick={()=>oppName.trim()&&addFriend(oppName.trim())}>➕ Add</button></div>:<button style={s.bs} onClick={()=>setShowFriendAdd(true)}>➕ Add Friend</button>}
      <button style={{marginTop:20,background:"transparent",border:"none",color:"#ffffff33",fontSize:13,cursor:"pointer"}} onClick={()=>setScreen("home")}>← Back</button>
    </div></div>
  );

  if(screen==="create-room") return <div style={s.page}><style>{css}</style><div style={s.center}><div style={{...s.lt,fontSize:26}}>BOLLYWOOD</div><div style={s.ls}>G R I D</div><div style={{...s.tag,marginTop:24}}>🏠 ROOM CODE</div><div style={{fontSize:52,fontWeight:900,letterSpacing:10,color:"#ff4d8d",textShadow:"0 0 30px #ff4d8d88",margin:"12px 0"}}>{roomCode}</div><div style={s.hint}>Share with your friend!</div><button style={s.bp} onClick={()=>{tap();navigator.share?navigator.share({title:"Bollywood Grid",text:`Join! Code: ${roomCode} 🎬`}):navigator.clipboard?.writeText(roomCode).then(()=>alert("Copied: "+roomCode));}}>📤 Share Code</button><button style={{...s.bs,marginTop:12}} onClick={()=>{tap();setCoinResult(null);setCoinFlipping(false);setScreen("coinflip");}}>✅ Friend Joined!</button><button style={{marginTop:16,background:"transparent",border:"none",color:"#ffffff33",fontSize:13,cursor:"pointer"}} onClick={()=>setScreen("home")}>← Back</button></div></div>;

  if(screen==="join-room") return <div style={s.page}><style>{css}</style><div style={s.center}><div style={{...s.lt,fontSize:26}}>BOLLYWOOD</div><div style={s.ls}>G R I D</div><div style={{...s.tag,marginTop:24}}>🔗 ENTER CODE</div><input style={s.ci} placeholder="e.g. AB12C" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={5}/>{roomError&&<div style={{color:"#ff6b6b",fontSize:13,marginBottom:10}}>{roomError}</div>}<button style={s.bp} onClick={confirmJoin}>🚀 Join Room</button><button style={{marginTop:16,background:"transparent",border:"none",color:"#ffffff33",fontSize:13,cursor:"pointer"}} onClick={()=>setScreen("home")}>← Back</button></div></div>;

  if(screen==="matchmaking") return <Matchmaking myName={myName} onMatch={(code,isHost)=>{setRoomCode(code);setGameMode(isHost?"friend-host":"friend-join");setCoinResult(null);setCoinFlipping(false);setScreen("coinflip");}} onBack={()=>setScreen("home")}/>;

  if(screen==="coinflip") return (
    <div style={s.page}><style>{css}</style>
    <div style={s.center}>
      <div style={{...s.lt,fontSize:26}}>BOLLYWOOD</div><div style={s.ls}>G R I D</div>
      <div style={{...s.tag,marginTop:24}}>🪙 COIN FLIP</div>
      <div style={{fontSize:11,color:"#ffffff44",letterSpacing:2,marginBottom:20}}>HEADS = GUESS · TAILS = SET</div>
      <div style={{width:120,height:120,margin:"0 auto 24px",cursor:!coinResult&&!coinFlipping?"pointer":"default",animation:coinFlipping?"spin3d 1.8s ease-out forwards":"none"}} onClick={!coinResult&&!coinFlipping?flipCoin:undefined}>
        {coinResult==="tails"?<CoinTails/>:<CoinHeads/>}
      </div>
      {!coinResult&&!coinFlipping&&<button style={s.bp} onClick={flipCoin}>🪙 Flip!</button>}
      {coinFlipping&&<div style={{...s.hint,fontSize:14}}>Flipping...</div>}
      {coinResult&&<><div style={{fontSize:24,fontWeight:900,color:"#ffd700",letterSpacing:4,marginBottom:8}}>{coinResult==="heads"?"⭐ HEADS!":"🏛️ TAILS!"}</div><div style={{fontSize:15,color:"#ff4d8d",fontWeight:700,marginBottom:22}}>{isGuesser?"🎯 You GUESS!":"✍️ You SET answers!"}</div><button style={s.bp} onClick={afterCoin} disabled={loading}>{loading?"Loading...":"Let's Go! 🔥"}</button></>}
    </div></div>
  );

  if(screen==="host-setup") return <div style={s.page}><style>{css}</style><div style={{...s.center,justifyContent:"flex-start",paddingTop:44}}><div style={{...s.lt,fontSize:24}}>SET ANSWERS</div><div style={{...s.hint,margin:"8px 0 16px"}}>Opponent sees only the first letter!</div>{fields.map(f=><div key={f} style={{width:"100%",marginTop:12}}><div style={{fontSize:10,letterSpacing:3,color:"#ffd700",marginBottom:5}}>{f.toUpperCase()}</div><input style={s.hi} placeholder={`${f} name...`} value={hostData[f]} onChange={e=>setHostData(p=>({...p,[f]:e.target.value}))}/></div>)}<button style={{...s.bp,marginTop:22}} onClick={submitHost}>🎬 Start!</button></div></div>;

  if(screen==="game") return (
    <div style={s.page}><style>{css}</style>
    {showTaunt&&<div style={s.tauntOverlay}>{showTaunt}</div>}
    {showTauntPicker&&<div style={s.overlay} onClick={()=>setShowTauntPicker(false)}><div style={{...s.mb,maxHeight:"72vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}><div style={s.mh}><span style={{color:"#ff4d8d",fontWeight:700}}>😈 PICK A TAUNT</span><button style={s.xb} onClick={()=>setShowTauntPicker(false)}>✕</button></div>{TAUNTS.map((t,i)=><button key={i} style={s.to} onClick={()=>sendTaunt(t)}>{t}</button>)}</div></div>}
    <FW/>
    {showChat&&<div style={s.cp}><div style={s.mh}><span>💬 Chat</span><button style={s.xb} onClick={()=>{setShowChat(false);setUnread(0);}}>✕</button></div><div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:8}}>{chatMsgs.map((m,i)=><div key={i} style={{padding:"8px 12px",borderRadius:12,fontSize:13,maxWidth:"82%",alignSelf:m.from==="me"?"flex-end":"flex-start",background:m.from==="me"?"#ff4d8d22":m.from==="system"?"#ffd70011":"#ffffff0d",borderRight:m.from==="me"?"2px solid #ff4d8d":"none",borderLeft:m.from==="system"?"2px solid #ffd700":"none"}}>{m.text}</div>)}<div ref={chatEnd}/></div><div style={{padding:12,display:"flex",flexDirection:"column",gap:8}}><div style={{display:"flex",gap:6}}>{QUICK_REACTIONS.map(r=><button key={r} style={{background:"#ffffff0d",border:"none",borderRadius:20,padding:"4px 6px",fontSize:17,cursor:"pointer"}} onClick={()=>{tap();addChat("me",r);}}>{r}</button>)}</div><div style={{display:"flex",gap:8}}><input style={s.chi} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder="Type..."/><button style={s.sb} onClick={sendChat}>↑</button></div></div></div>}

    <div style={{flex:1,display:"flex",flexDirection:"column",padding:"10px 14px",gap:10}}>
      <div style={{display:"flex",justifyContent:"center",gap:5,padding:"6px 0"}}>
        {BOLLYWOOD_LETTERS.map((l,i)=><div key={i} style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:20,fontWeight:700,transition:"all .3s",color:i<lives?"#ff4d8d":"#222",textShadow:i<lives?"0 0 10px #ff4d8d":"none"}}>{l}</div>)}
      </div>
      <div style={{position:"relative",display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",border:"1px solid #ff4d8d33",borderRadius:10,overflow:"hidden",aspectRatio:"1.5/1",flexShrink:0,animation:wrongShake?"shake .5s ease":"none"}}>
        <div style={{position:"absolute",left:"50%",top:0,bottom:0,width:1,background:"#ff4d8d55",zIndex:5}}/>
        <div style={{position:"absolute",top:"50%",left:0,right:0,height:1,background:"#ff4d8d55",zIndex:5}}/>
        {fields.map(f=>(
          <div key={f} style={{padding:"10px 14px",display:"flex",flexDirection:"column",justifyContent:"center",position:"relative",background:solved[f]?"#00f5a008":currentField===f&&isGuesser?"#ff4d8d08":"transparent",cursor:isGuesser&&!solved[f]?"pointer":"default",transition:"background .3s"}} onClick={()=>{if(isGuesser&&!solved[f]){tap();setCurrentField(f);}}}>
            <div style={{fontSize:8,letterSpacing:3,color:"#ffffff44",fontWeight:700,marginBottom:3}}>{f.toUpperCase()}</div>
            {solved[f]?<div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#00f5a0",textShadow:"0 0 8px #00f5a055",lineHeight:1.3}}>{round[f].replace(/\(.*\)/g,"").trim()}</div>:<div style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:38,color:"#ff4d8d",textShadow:"0 0 20px #ff4d8d88",lineHeight:1}}>{round?round[f][0].toUpperCase():"?"}</div>}
            {currentField===f&&!solved[f]&&isGuesser&&<div style={{position:"absolute",bottom:4,left:14,right:14,height:2,background:"#ff4d8d",borderRadius:2,animation:"pulse 1s infinite"}}/>}
          </div>
        ))}
      </div>
      {isGuesser&&<div style={{display:"flex",flexDirection:"column",gap:6}}><div style={{fontSize:10,letterSpacing:2,color:"#ffffff44"}}>GUESSING: <span style={{color:"#ff4d8d"}}>{currentField.toUpperCase()}</span></div><div style={{display:"flex",gap:8}}><input style={s.gi} value={inputVal} onChange={e=>setInputVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitGuess()} placeholder={`Type ${currentField}...`}/><button style={s.gsb} onClick={submitGuess}>↑</button></div></div>}
      <div style={{flex:1,display:"flex",flexDirection:"column",background:"#ffffff05",borderRadius:10,overflow:"hidden",minHeight:110,border:"1px solid #ffffff0d"}}>
        <div style={{fontSize:9,color:"#ffffff22",padding:"4px 10px",letterSpacing:2}}>✏️ SCRIBBLE</div>
        <canvas ref={canvasRef} style={{flex:1,cursor:"crosshair",touchAction:"none",display:"block"}}/>
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 8px",background:"#000000aa",flexWrap:"wrap"}}>
          {BRUSH_COLORS.map(c=><button key={c} onClick={()=>setBrushColor(c)} style={{width:20,height:20,borderRadius:"50%",background:c,border:brushColor===c?"3px solid white":"2px solid transparent",cursor:"pointer",flexShrink:0}}/>)}
          <button onClick={()=>setBrushColor("eraser")} style={{background:"#ffffff22",border:brushColor==="eraser"?"3px solid white":"2px solid transparent",borderRadius:4,padding:"1px 5px",color:"#000",fontSize:10,cursor:"pointer",fontWeight:700}}>⬜</button>
          <button style={{background:"transparent",border:"1px solid #ffffff22",borderRadius:20,padding:"2px 7px",color:"#ffffff66",fontSize:9,cursor:"pointer",fontFamily:"inherit",fontWeight:700}} onClick={clearCanvas}>CLEAR</button>
          <button style={{background:"#ff4d8d1a",border:"1px solid #ff4d8d44",borderRadius:20,padding:"2px 7px",color:"#ff4d8d",fontSize:9,cursor:"pointer",marginLeft:"auto",fontFamily:"inherit",fontWeight:700}} onClick={()=>{tap();setShowTauntPicker(true);}}>😈 TAUNT</button>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:14,padding:"2px 0"}}>
        <button style={{background:"#ffffff0d",border:"1px solid #ffffff1a",borderRadius:50,width:40,height:40,fontSize:16,cursor:"pointer"}} onClick={()=>{tap();setScreen("home");}}>🏠</button>
        <button style={{background:"#ffffff0d",border:"1px solid #ffffff1a",borderRadius:50,width:40,height:40,fontSize:16,cursor:"pointer",position:"relative"}} onClick={()=>{setShowChat(c=>!c);setUnread(0);}}>💬{unread>0&&<span style={{position:"absolute",top:-3,right:-3,background:"#ff4d8d",borderRadius:"50%",width:14,height:14,fontSize:8,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{unread}</span>}</button>
      </div>
    </div>
    <div style={{textAlign:"center",fontSize:9,letterSpacing:4,color:"#ff4d8d33",padding:"3px 0 7px",fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>BOLLYWOOD GRID</div>
    </div>
  );

  const GoScreen=({won})=>(
    <div style={s.page}><style>{css}</style><FW/>
    <div style={s.center}>
      <div style={{fontSize:56,margin:"14px 0"}}>{won?"🎉":"💀"}</div>
      <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:900,fontSize:42,letterSpacing:4,marginBottom:18,color:won?"#00f5a0":"#ff4d8d",textShadow:`0 0 30px ${won?"#00f5a077":"#ff4d8d77"}`}}>{won?"YOU WON!":"GAME OVER"}</div>
      <div style={{background:"#ffffff08",border:"1px solid #ffffff11",borderRadius:16,padding:"16px 20px",width:"100%",maxWidth:310}}>
        <div style={{fontSize:9,letterSpacing:3,color:"#ffffff44",marginBottom:12,textAlign:"center"}}>THE ANSWERS WERE</div>
        {fields.map(f=><div key={f} style={{display:"flex",gap:8,marginBottom:9,alignItems:"baseline"}}><span style={{fontSize:11,fontWeight:700,color:"#ff4d8d",letterSpacing:2,minWidth:68}}>{f.toUpperCase()}:</span><span style={{fontSize:14,color:"#fff",fontWeight:600}}>{round?.[f]}</span></div>)}
      </div>
      <div style={{display:"flex",gap:10,marginTop:18,flexWrap:"wrap",justifyContent:"center"}}>
        {gameMode!=="bot"&&<button style={{...s.bo,fontSize:13,padding:"12px 20px"}} onClick={()=>setShowFriendAdd(true)}>➕ Add Friend</button>}
        <button style={s.bp} onClick={()=>{tap();setGameMode("bot");startBot();}}>🔄 Next</button>
        <button style={s.bo} onClick={()=>{tap();setScreen("home");}}>🏠 Home</button>
      </div>
      {showFriendAdd&&<div style={{marginTop:14,width:"100%",display:"flex",flexDirection:"column",gap:8}}><input style={{...s.ci,fontSize:15,letterSpacing:1}} placeholder="Opponent's name..." value={oppName} onChange={e=>setOppName(e.target.value)}/><button style={s.bs} onClick={()=>oppName.trim()&&addFriend(oppName.trim())}>Add Friend</button></div>}
    </div></div>
  );

  if(screen==="win") return <GoScreen won={true}/>;
  if(screen==="lose") return <GoScreen won={false}/>;
  return null;
}

// ─── Compact Styles ───────────────────────────────────────────────────────────
const s={
  splash:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0a0a0a",position:"relative",overflow:"hidden"},
  sGlow:{position:"absolute",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,#9b2d6644 0%,transparent 70%)",top:"50%",left:"50%",transform:"translate(-50%,-55%)"},
  dots:{display:"flex",gap:8,marginTop:28},
  dot:{width:8,height:8,borderRadius:"50%",background:"#ff4d8d88",display:"inline-block",animation:"pulse 1.2s infinite"},
  page:{minHeight:"100vh",background:"#0a0a0a",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden",maxWidth:420,margin:"0 auto"},
  center:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px"},
  lt:{fontFamily:"'Montserrat',sans-serif",fontWeight:900,fontSize:32,letterSpacing:8,color:"#ff4d8d",textShadow:"0 0 30px #ff4d8d55"},
  ls:{fontFamily:"'Montserrat',sans-serif",fontWeight:300,fontSize:14,letterSpacing:14,color:"#ffd700",marginTop:2},
  tag:{fontSize:12,letterSpacing:3,color:"#ffd700",fontWeight:700,marginBottom:10},
  hint:{fontSize:12,color:"#ffffff44",marginBottom:14,textAlign:"center"},
  bp:{background:"linear-gradient(135deg,#ff4d8d,#ff2070)",color:"#fff",border:"none",borderRadius:50,padding:"15px 30px",fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:1,boxShadow:"0 4px 20px #ff4d8d33",fontFamily:"inherit"},
  bs:{background:"transparent",color:"#ff4d8d",border:"2px solid #ff4d8d",borderRadius:50,padding:"13px 30px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"},
  bo:{background:"transparent",color:"#ffffff66",border:"2px solid #ffffff1a",borderRadius:50,padding:"13px 28px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"},
  ib:{background:"#ffffff0d",border:"1px solid #ffffff1a",borderRadius:50,width:48,height:48,fontSize:20,cursor:"pointer"},
  ci:{background:"#ffffff0d",border:"2px solid #ff4d8d33",borderRadius:12,padding:"13px 18px",color:"#fff",fontSize:20,fontWeight:900,letterSpacing:5,textAlign:"center",width:"100%",maxWidth:240,marginBottom:18,outline:"none",fontFamily:"inherit"},
  hi:{background:"#ffffff0d",border:"1px solid #ff4d8d33",borderRadius:10,padding:"12px 14px",color:"#fff",fontSize:14,width:"100%",outline:"none",fontFamily:"inherit"},
  gi:{flex:1,background:"#ffffff0d",border:"1px solid #ff4d8d55",borderRadius:10,padding:"12px 14px",color:"#fff",fontSize:15,outline:"none",fontFamily:"inherit"},
  gsb:{background:"#ff4d8d",border:"none",borderRadius:10,width:44,height:44,color:"#fff",fontSize:18,cursor:"pointer",flexShrink:0},
  chi:{flex:1,background:"#ffffff0d",border:"1px solid #ffffff1a",borderRadius:20,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none",fontFamily:"inherit"},
  sb:{background:"#ff4d8d",border:"none",borderRadius:"50%",width:36,height:36,color:"#fff",fontSize:16,cursor:"pointer"},
  overlay:{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  mb:{background:"#111",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:420,padding:"0 0 28px"},
  mh:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"15px 18px",borderBottom:"1px solid #ffffff0d"},
  xb:{background:"transparent",border:"none",color:"#ffffff55",fontSize:18,cursor:"pointer"},
  lbr:{display:"flex",alignItems:"center",gap:10,padding:"10px 18px",borderBottom:"1px solid #ffffff08"},
  lbrank:{fontSize:16,minWidth:26},
  to:{display:"block",width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #ffffff08",padding:"14px 18px",color:"#fff",fontSize:14,textAlign:"left",cursor:"pointer",fontFamily:"inherit"},
  tauntOverlay:{position:"fixed",top:"18%",left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#ff4d8d,#ff2070)",color:"#fff",padding:"14px 20px",borderRadius:16,fontSize:15,fontWeight:700,zIndex:999,boxShadow:"0 8px 32px #ff4d8d66",animation:"fadeUp .3s ease",maxWidth:290,textAlign:"center"},
  cp:{position:"fixed",bottom:0,left:0,right:0,maxWidth:420,margin:"0 auto",background:"#111",border:"1px solid #ff4d8d22",borderRadius:"20px 20px 0 0",zIndex:100,display:"flex",flexDirection:"column",maxHeight:"58vh"},
};

const css=`
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Montserrat:wght@300;400;700;900&display=swap');
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
  @keyframes spin3d{0%{transform:rotateY(0) scale(1)}40%{transform:rotateY(720deg) scale(1.2)}100%{transform:rotateY(1440deg) scale(1)}}
  @keyframes fw{0%{opacity:1;transform:scale(0)}60%{opacity:1;transform:scale(2.5)}100%{opacity:0;transform:scale(4.5)}}
  *{-webkit-tap-highlight-color:transparent;box-sizing:border-box}
  input{-webkit-appearance:none}
  ::-webkit-scrollbar{width:3px}
  ::-webkit-scrollbar-track{background:#111}
  ::-webkit-scrollbar-thumb{background:#ff4d8d44;border-radius:2px}
`;
