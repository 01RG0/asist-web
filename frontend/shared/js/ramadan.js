/**
 * Ramadan UI Decorations
 * Injects animated lanterns, multi-colored banners, and twinkling stars into the UI.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Avoid double injection
    if (document.querySelector('.ramadan-container')) return;

    // Create container
    const container = document.createElement('div');
    container.className = 'ramadan-container';

    // Add Zeenah (Banner)
    const zeenahContainer = document.createElement('div');
    zeenahContainer.className = 'ramadan-zeenah-container';

    const zeenahString = document.createElement('div');
    zeenahString.className = 'ramadan-zeenah-string';

    const zeenah = document.createElement('div');
    zeenah.className = 'ramadan-zeenah';

    zeenahContainer.appendChild(zeenahString);
    zeenahContainer.appendChild(zeenah);
    container.appendChild(zeenahContainer);

    // Add Twinkling Stars randomly
    for (let i = 0; i < 20; i++) {
        const star = document.createElement('div');
        star.className = 'ramadan-star';
        const size = Math.random() * 3 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.animationDelay = `${Math.random() * 5}s`;
        star.style.animationDuration = `${3 + Math.random() * 2}s`;
        container.appendChild(star);
    }

    // Function to create a lantern with intricate SVG
    const createLantern = (className, style = {}) => {
        const lantern = document.createElement('div');
        lantern.className = `ramadan-lantern ${className}`;

        lantern.innerHTML = `
            <svg viewBox="0 0 50 100" xmlns="http://www.w3.org/2000/svg">
                <!-- Top Cap -->
                <path d="M25 0 L15 15 L35 15 Z" fill="#ffd700" filter="url(#glow)"/>
                <rect x="18" y="15" width="14" height="4" fill="#f0c27b"/>
                
                <!-- Glass Body with Intricate Pattern -->
                <path d="M12 20 L38 20 L42 60 L8 60 Z" fill="rgba(255, 215, 0, 0.2)" stroke="#ffd700" stroke-width="1.5"/>
                <!-- Geometric inside -->
                <path d="M25 20 L12 40 L25 60 L38 40 Z" fill="#ffd700" fill-opacity="0.6"/>
                <path d="M12 20 L25 40 M38 20 L25 40 M25 40 L25 60" stroke="#ffd700" stroke-width="0.5"/>
                
                <!-- Bottom Base -->
                <path d="M8 60 L42 60 L38 80 L12 80 Z" fill="#f0c27b"/>
                <path d="M15 80 L35 80 L25 95 Z" fill="#ffd700"/>
                
                <!-- Glow Effect -->
                <circle cx="25" cy="40" r="10" fill="#fff" fill-opacity="0.4">
                    <animate attributeName="opacity" values="0.2;0.6;0.2" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="r" values="8;12;8" dur="3s" repeatCount="indefinite" />
                </circle>
                
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="1" result="blur"/>
                        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                    </filter>
                </defs>
            </svg>
        `;

        Object.assign(lantern.style, style);
        return lantern;
    };

    // Add Lanterns
    container.appendChild(createLantern('lantern-left'));
    container.appendChild(createLantern('lantern-right'));
    container.appendChild(createLantern('lantern-extra-1', { left: '25%' }));
    container.appendChild(createLantern('lantern-extra-2', { right: '25%' }));


    // Add Countdown Timer
    const countdown = document.createElement('div');
    countdown.className = 'ramadan-countdown';
    countdown.innerHTML = `
        <span class="countdown-label">الوقت المتبقي للإفطار</span>
        <span class="countdown-time" id="iftar-timer">00:00:00</span>
    `;
    container.appendChild(countdown);

    // Countdown Logic with API
    let iftarTime = null;

    const fetchIftarTime = async () => {
        try {
            // Get user location or default to Cairo
            const city = "Alexandria";
            const country = "Egypt";
            const response = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&method=5`);
            const data = await response.json();

            if (data.code === 200) {
                const maghrib = data.data.timings.Maghrib; // e.g., "18:05"
                const [hours, minutes] = maghrib.split(':');

                const target = new Date();
                target.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                iftarTime = target;
                console.log(`🌙 Iftar time fetched: ${maghrib}`);
            }
        } catch (error) {
            console.error("Failed to fetch Iftar time:", error);
            // Fallback to default 6:00 PM if API fails
            const fallback = new Date();
            fallback.setHours(18, 0, 0, 0);
            iftarTime = fallback;
        }
    };

    const updateTimer = () => {
        if (!iftarTime) return;

        const now = new Date();
        let diff = iftarTime - now;

        // If it's already past iftar today, show for tomorrow (or logic can be adjusted to show "Iftar time!")
        if (diff < 0) {
            // Check if we just passed it (within 2 hours)
            if (diff > -7200000) {
                document.getElementById('iftar-timer').textContent = "صوماً مقبولاً!";
                return;
            }
            // Otherwise show for tomorrow
            const tomorrow = new Date(iftarTime);
            tomorrow.setDate(tomorrow.getDate() + 1);
            diff = tomorrow - now;
        }

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        const timerEl = document.getElementById('iftar-timer');
        if (timerEl) {
            timerEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
    };

    fetchIftarTime().then(() => {
        setInterval(updateTimer, 1000);
        updateTimer();
    });

    // Add Greeting with Icon
    const greeting = document.createElement('div');
    greeting.className = 'ramadan-greeting';
    greeting.innerHTML = '🌙 <b>رمضان كريم</b> - <span style="font-weight: 300">Ramadan Kareem</span>';

    // Append all to body
    document.body.appendChild(greeting);
    document.body.appendChild(container);

    console.log('🌙 Premium Ramadan Decorations with Iftar Timer Active');
});
