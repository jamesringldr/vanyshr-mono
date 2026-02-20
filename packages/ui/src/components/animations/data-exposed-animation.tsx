import type { ReactElement } from "react";

export const DataExposedAnimation = (): ReactElement => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" width="100%" height="100%">
            <title>Your Personal Data is Exposed - Cloud Animation</title>
            <desc>A central cloud representing online data, surrounded by orbiting icons representing various exposed personal data points like bank, home, location, and phone.</desc>
            
            <defs>
                <style>{`
                    /* Core animations */
                    @keyframes orbit {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    @keyframes counter-orbit {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(-360deg); }
                    }
                    
                    @keyframes float-cloud {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-16px); }
                    }
                    
                    @keyframes float-icon {
                        0%, 100% { transform: translateY(0px) scale(1); }
                        50% { transform: translateY(-12px) scale(1.05); }
                    }

                    /* Apply animations */
                    .cloud-group {
                        animation: float-cloud 6s ease-in-out infinite;
                        transform-origin: center;
                    }

                    .orbit-system {
                        animation: orbit 50s linear infinite;
                        transform-origin: 300px 210px;
                    }

                    .counter-rotate {
                        animation: counter-orbit 50s linear infinite;
                    }

                    .icon-wrapper {
                        animation: float-icon 4.5s ease-in-out infinite;
                    }

                    /* Stagger icon float animations for a dynamic, organic feel */
                    .delay-1 { animation-delay: 0.0s; }
                    .delay-2 { animation-delay: -0.6s; }
                    .delay-3 { animation-delay: -1.2s; }
                    .delay-4 { animation-delay: -1.8s; }
                    .delay-5 { animation-delay: -2.4s; }
                    .delay-6 { animation-delay: -3.0s; }
                    .delay-7 { animation-delay: -3.6s; }
                    .delay-8 { animation-delay: -4.2s; }
                `}</style>

                <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#000000" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Orbit paths are relative to center 300, 210 */}
            <g className="orbit-system">
                {/* 1. Top: Phone */}
                <g className="counter-rotate" style={{ transformOrigin: "300px 40px" }}>
                    <g className="icon-wrapper delay-1">
                        <circle cx="300" cy="40" r="28" fill="#FFFFFF" filter="url(#shadow)" />
                        <g transform="translate(284, 24) scale(1.333)" fill="#363943">
                            <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 00-1.02.24l-2.2 2.2a15.045 15.045 0 01-6.59-6.59l2.2-2.21a.96.96 0 00.25-1A11.36 11.36 0 018.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/>
                        </g>
                    </g>
                </g>

                {/* 2. Top Right: Bank */}
                <g className="counter-rotate" style={{ transformOrigin: "420px 90px" }}>
                    <g className="icon-wrapper delay-2">
                        <circle cx="420" cy="90" r="28" fill="#FFFFFF" filter="url(#shadow)" />
                        <g transform="translate(404, 74) scale(1.333)" fill="#363943">
                            <path d="M12 1L2 6v2h20V6L12 1zM4 10h3v7H4v-7zm6 0h4v7h-4v-7zm7 0h3v7h-3v-7zM2 19h20v3H2v-3z"/>
                        </g>
                    </g>
                </g>

                {/* 3. Right: Building */}
                <g className="counter-rotate" style={{ transformOrigin: "470px 210px" }}>
                    <g className="icon-wrapper delay-3">
                        <circle cx="470" cy="210" r="28" fill="#FFFFFF" filter="url(#shadow)" />
                        <g transform="translate(454, 194) scale(1.333)" fill="#363943">
                            <path d="M17 11V3H7v4H3v14h18V11h-4zm-8-6h4v2H9V5zm0 4h4v2H9V9zm0 4h4v2H9v-2zm-4 4h2v2H5v-2zm0-4h2v2H5v-2zm0-4h2v2H5V9zm12 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/>
                        </g>
                    </g>
                </g>

                {/* 4. Bottom Right: Credit Card */}
                <g className="counter-rotate" style={{ transformOrigin: "420px 330px" }}>
                    <g className="icon-wrapper delay-4">
                        <circle cx="420" cy="330" r="28" fill="#FFFFFF" filter="url(#shadow)" />
                        <g transform="translate(404, 314) scale(1.333)" fill="#363943">
                            <path d="M2 6c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v2H2V6zm0 6v6c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-6H2zm14 3h3v2h-3v-2z"/>
                        </g>
                    </g>
                </g>

                {/* 5. Bottom: Home */}
                <g className="counter-rotate" style={{ transformOrigin: "300px 380px" }}>
                    <g className="icon-wrapper delay-5">
                        <circle cx="300" cy="380" r="28" fill="#FFFFFF" filter="url(#shadow)" />
                        <g transform="translate(284, 364) scale(1.333)" fill="#363943">
                            <path d="M12 2 L2 11 H4 V21 H9 V19 C9 17.34 10.34 16 12 16 C13.66 16 15 17.34 15 19 V21 H20 V11 H22 L12 2 Z M12 14.5 C10.62 14.5 9.5 13.38 9.5 12 C9.5 10.62 10.62 9.5 12 9.5 C13.38 9.5 14.5 10.62 14.5 12 C14.5 13.38 13.38 14.5 12 14.5 Z"/>
                        </g>
                    </g>
                </g>

                {/* 6. Bottom Left: Key */}
                <g className="counter-rotate" style={{ transformOrigin: "180px 330px" }}>
                    <g className="icon-wrapper delay-6">
                        <circle cx="180" cy="330" r="28" fill="#FFFFFF" filter="url(#shadow)" />
                        <g transform="translate(164, 314) scale(1.333)" fill="#363943">
                            <path d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H14v4h4v-4h3v-4h-8.35zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
                        </g>
                    </g>
                </g>

                {/* 7. Left: Group */}
                <g className="counter-rotate" style={{ transformOrigin: "130px 210px" }}>
                    <g className="icon-wrapper delay-7">
                        <circle cx="130" cy="210" r="28" fill="#FFFFFF" filter="url(#shadow)" />
                        <g transform="translate(114, 194) scale(1.333)" fill="#363943">
                            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                        </g>
                    </g>
                </g>

                {/* 8. Top Left: Mail */}
                <g className="counter-rotate" style={{ transformOrigin: "180px 90px" }}>
                    <g className="icon-wrapper delay-8">
                        <circle cx="180" cy="90" r="28" fill="#FFFFFF" filter="url(#shadow)" />
                        <g transform="translate(164, 74) scale(1.333)" fill="#363943">
                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/>
                        </g>
                    </g>
                </g>
            </g>

            <g transform="translate(0, -90)">
                <g className="cloud-group">
                    <path d="M 405 390 L 225 390 C 191.86 390 165 363.14 165 330 C 165 298.72 188.95 272.8 219.34 270.27 C 228.78 235.75 260.42 210 298.33 210 C 336.74 210 368.74 236.36 377.68 271.53 C 409.8 276.42 435 304.22 435 338.33 C 435 366.86 411.86 390 405 390 Z" 
                          fill="#2BA4FF" 
                          stroke="#C3ECFF" 
                          strokeWidth="16" 
                          strokeLinejoin="round" />
                </g>
            </g>
        </svg>
    );
};
