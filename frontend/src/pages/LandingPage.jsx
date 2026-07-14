import { useNavigate } from 'react-router-dom';
import { rraLogo } from '../assets';
import { MapPin, Shield, Zap, FileText } from 'lucide-react';

// Slightly darker RRA blue palette
const BG = 'linear-gradient(150deg, #0b2d52 0%, #17538c 50%, #103f6a 100%)';

const steps = [
    {
        n: '01',
        icon: MapPin,
        title: 'Set Your Route',
        desc: 'Enter your pickup and destination. Nearby drivers appear on the map instantly.',
    },
    {
        n: '02',
        icon: Zap,
        title: 'Get Matched Fast',
        desc: 'A verified driver accepts your request in seconds. Track them live to your door.',
    },
    {
        n: '03',
        icon: Shield,
        title: 'Ride Safely',
        desc: 'Complete your journey with a smooth and reliable transportation experience.',
    },
];

const stats = [
    { value: '18%',  label: 'Auto Tax Rate' },
    { value: '24/7', label: 'Availability' },
];

const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col" style={{ background: BG }}>

            {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
            <nav className="flex items-center justify-between px-6 md:px-14 py-5">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center p-1 shadow-md shrink-0">
                        <img src={rraLogo} alt="RRA" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-white uppercase tracking-tight leading-none">RideShare</p>
                        <p className="text-[9px] font-bold leading-none mt-0.5" style={{ color: 'var(--rra-gold)' }}>
                            Platform
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/login')}
                        className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white border border-white/25 hover:bg-white/10 transition-all active:scale-95"
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => navigate('/register')}
                        className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-white hover:bg-gray-100 transition-all active:scale-95"
                        style={{ color: '#17538c' }}
                    >
                        Register
                    </button>
                </div>
            </nav>

            {/* ── BODY ───────────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col lg:flex-row items-center gap-12 px-6 md:px-14 py-6 max-w-7xl mx-auto w-full">

                {/* LEFT — hero text + stats */}
                <div className="flex-1 text-white">

                    {/* Headline */}
                    <h1 className="text-[2.6rem] md:text-5xl font-black leading-[1.05] tracking-tight mb-5">
                        Rwanda's<br />
                        <span style={{ color: 'var(--rra-gold)' }}>Smartest</span><br />
                        Ride Platform
                    </h1>

                    <p className="text-white/70 text-sm leading-relaxed mb-8 max-w-sm">
                        Book a ride in seconds, pay securely, and let the platform handle RRA tax reporting automatically.
                    </p>

                    {/* CTA */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-10">
                        <button
                            onClick={() => navigate('/login')}
                            className="px-8 py-3.5 bg-white rounded-2xl text-sm font-black uppercase tracking-wider shadow-xl hover:bg-gray-50 active:scale-95 transition-all"
                            style={{ color: '#17538c' }}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => navigate('/register')}
                            className="px-8 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wider border-2 border-white/30 text-white hover:bg-white/10 active:scale-95 transition-all"
                        >
                            Create Account
                        </button>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-4 max-w-sm">
                        {stats.map(s => (
                            <div key={s.label}>
                                <p className="text-xl font-black text-white leading-none">{s.value}</p>
                                <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider mt-1 leading-tight">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT — How it works */}
                <div className="w-full lg:w-[400px] xl:w-[440px]">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-5">
                        How it works
                    </p>

                    <div className="space-y-3">
                        {steps.map((step, i) => (
                            <div
                                key={step.n}
                                className="flex gap-4 p-5 rounded-2xl border border-white/10 bg-white/6 backdrop-blur-sm hover:bg-white/10 transition-colors"
                            >
                                {/* Step number */}
                                <div className="flex flex-col items-center gap-2 shrink-0">
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                                        style={{ background: 'rgba(255,255,255,0.12)' }}
                                    >
                                        <step.icon size={16} />
                                    </div>
                                    {/* Connector line */}
                                    {i < steps.length - 1 && (
                                        <div className="w-px flex-1 min-h-[16px] bg-white/10" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 pb-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black text-white/30 tracking-widest">{step.n}</span>
                                        <p className="text-sm font-black text-white">{step.title}</p>
                                    </div>
                                    <p className="text-xs text-white/55 leading-relaxed font-medium">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── FOOTER ─────────────────────────────────────────────────────── */}
            <p className="text-center pb-5 text-[11px] text-white/25 font-medium">
                © {new Date().getFullYear()} RideShare · Rwanda Revenue Authority
            </p>
        </div>
    );
};

export default LandingPage;
