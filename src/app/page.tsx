import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-[var(--header-height)] flex items-center justify-between px-6 border-b border-[var(--bg-tertiary)]">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-blue)] bg-clip-text text-transparent">
            m8trader$
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 text-sm bg-[var(--accent-purple)] hover:bg-[var(--accent-purple)]/80 text-white rounded-lg transition-colors"
          >
            Mulai Belajar
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="max-w-3xl mx-auto">
          {/* Logo */}
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-blue)] bg-clip-text text-transparent">
              m8trader$
            </span>
          </h1>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-[var(--text-secondary)] mb-2">
            Sekolah Pasar Modal
          </p>
          <p className="text-lg text-[var(--accent-primary)] font-medium mb-8">
            &ldquo;Disiplin Dulu, Profit Kemudian&rdquo;
          </p>

          {/* Description */}
          <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto mb-12">
            Platform edukasi trading interaktif dengan simulasi real-time. Belajar analisis
            teknikal, fundamental, dan{' '}
            <span className="text-[var(--emotion-calm)]">kontrol emosi</span> dalam trading.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-4 bg-[var(--accent-purple)] hover:bg-[var(--accent-purple)]/80 text-white rounded-xl text-lg font-medium transition-all glow-primary"
            >
              Mulai Belajar →
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 border border-[var(--bg-tertiary)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] rounded-xl text-lg font-medium transition-all"
            >
              Lihat Fitur
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-[var(--bg-secondary)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Apa yang Akan Kamu Pelajari</h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-card p-6 rounded-xl">
              <div className="w-12 h-12 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Analisis Teknikal</h3>
              <p className="text-[var(--text-secondary)]">
                Candlestick patterns, indikator teknikal (RSI, MACD, MA), dan chart analysis dengan
                data real.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-card p-6 rounded-xl">
              <div className="w-12 h-12 rounded-lg bg-[var(--accent-blue)]/20 flex items-center justify-center mb-4">
                <span className="text-2xl">📈</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Analisis Fundamental</h3>
              <p className="text-[var(--text-secondary)]">
                Memahami valuasi saham, laporan keuangan, dan cara mengevaluasi perusahaan.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-card p-6 rounded-xl">
              <div className="w-12 h-12 rounded-lg bg-[var(--emotion-calm)]/20 flex items-center justify-center mb-4">
                <span className="text-2xl">🧠</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Kontrol Emosi</h3>
              <p className="text-[var(--text-secondary)]">
                Mengatasi FOMO, revenge trading, dan membangun disiplin trading yang konsisten.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Simulator Preview */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Simulasi Trading Real-Time</h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto mb-12">
            Praktik trading dengan data historis nyata. Pause, analisis, dan prediksi pergerakan
            harga tanpa risiko kehilangan uang.
          </p>

          {/* Placeholder for simulator preview */}
          <div className="aspect-video max-w-4xl mx-auto rounded-xl bg-[var(--chart-bg)] border border-[var(--bg-tertiary)] flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl mb-4 block">📉</span>
              <p className="text-[var(--text-secondary)]">Preview Simulator</p>
              <p className="text-sm text-[var(--text-tertiary)]">(Coming Soon)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[var(--bg-tertiary)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-[var(--text-secondary)]">
            © 2026 m8traders. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-sm text-[var(--text-tertiary)]">
            <a href="mailto:info@m8traders.com" className="hover:text-[var(--text-primary)]">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
