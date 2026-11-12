const slots = [
  { time: '07:30', name: 'La primera rareza', status: 'Programado' },
  { time: '14:30', name: 'El descubrimiento del día', status: 'Programado' },
  { time: '20:30', name: 'La última pregunta', status: 'Programado' },
];

export default function Home() {
  return <main className="shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">N</span><span>NEXO <b>RARO</b><small>STUDIO / CONTROL ROOM</small></span></a><span className="live"><i /> SISTEMA EN CONFIGURACIÓN</span></header>
    <section className="hero" id="top"><div className="eyebrow">EXPLORA LO EXTRAORDINARIO</div><h1>Hay más ahí fuera<br/><em>de lo que imaginas.</em></h1><p>Tu centro de producción: historias reales, ciencia sorprendente y lugares que despiertan curiosidad.</p><div className="hero-foot"><span>CANAL / NEXO RARO</span><span>ESPAÑA · EUROPE/MADRID</span></div></section>
    <section className="section-head"><div><div className="eyebrow">01 / PRODUCCIÓN DIARIA</div><h2>Tu calendario</h2></div><span className="muted">3 VÍDEOS / DÍA</span></section>
    <section className="schedule">{slots.map((slot, i) => <article className="slot" key={slot.time}><div className="slot-index">0{i + 1}</div><div className="slot-time">{slot.time}</div><div className="slot-info"><strong>{slot.name}</strong><small>Guion · voz · montaje · revisión</small></div><span className="pill">{slot.status}</span></article>)}</section>
    <section className="grid"><article className="panel"><div className="eyebrow">02 / MOTOR</div><h3>Pipeline de vídeo</h3><p>Investigación verificada → guion → narración → HyperFrames → render vertical → control de calidad.</p><div className="progress"><span /></div><small className="muted">A la espera de configurar proveedores y motor de render.</small></article><article className="panel mascot"><div className="eyebrow">03 / IDENTIDAD</div><div className="mascot-icon">✳</div><h3>Tilo está preparando la expedición.</h3><p>La mascota y el lenguaje visual de Nexo Raro guiarán cada episodio.</p></article></section>
    <footer><span>NEXO RARO © 2026</span><span>EXPLORA LO EXTRAORDINARIO</span></footer>
  </main>;
}
