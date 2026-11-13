import Link from 'next/link';

export default function Home(){
 return <main className="shell">
  <header className="topbar">
   <a className="brand" href="/"><span className="brand-mark brand-mark-world"><img src="/brand-mark.svg" alt=""/></span><span>BEHIND <b>DEL MUNDO</b><small>STUDIO / GENERADOR</small></span></a>
   <Link className="login-link" href="/studio">Abrir generador ↗</Link>
  </header>
  <section className="hero">
   <div className="eyebrow">TRES PROMPTS · TRES VÍDEOS</div>
   <h1>Explícalo.<br/><em>Lo convertimos en vídeo.</em></h1>
   <p>Pega los tres prompts del día y el motor creará tres vídeos verticales con animación dibujada por código, narración en español, música, efectos y subtítulos.</p>
   <div className="hero-foot"><span>BEHIND DEL MUNDO</span><span>ANIMACIÓN · VOZ · SONIDO · MP4</span></div>
  </section>
  <section className="section-head"><div><div className="eyebrow">EL PROCESO</div><h2>De una idea a un vídeo terminado</h2></div></section>
  <section className="schedule">
   <article className="slot"><div className="slot-index">01</div><div className="slot-time">PROMPT</div><div className="slot-info"><strong>Escribes qué quieres explicar</strong><small>Cómo funciona algo, qué hay dentro de un lugar o una curiosidad.</small></div><span className="pill">Tu idea</span></article>
   <article className="slot"><div className="slot-index">02</div><div className="slot-time">MOTOR</div><div className="slot-info"><strong>Se dibuja y anima cada escena</strong><small>Ilustraciones y cortes visuales diseñados para seguir la narración.</small></div><span className="pill">Código</span></article>
   <article className="slot"><div className="slot-index">03</div><div className="slot-time">MP4</div><div className="slot-info"><strong>Se genera y publica</strong><small>Voz española, música, efectos, subtítulos y envío a YouTube y TikTok cuando las cuentas estén conectadas.</small></div><span className="pill">Automático</span></article>
  </section>
  <section className="grid">
   <article className="panel"><div className="eyebrow">MOTOR VISUAL</div><h3>Animación creada mediante código</h3><p>Python, Pillow, NumPy y FFmpeg. Objetos, mecanismos, interiores, diagramas y movimiento hechos para explicar cada tema, no una presentación de imágenes.</p></article>
   <article className="panel mascot"><div className="eyebrow">SONIDO Y NARRACIÓN</div><div className="mascot-icon">✳</div><h3>Una voz. Un mundo por descubrir.</h3><p>Narrador masculino en español de España, música ambiental original, efectos sincronizados y subtítulos.</p></article>
  </section>
  <footer>BEHIND DEL MUNDO © 2026 · DESCUBRE LO QUE HAY DETRÁS</footer>
 </main>
}
