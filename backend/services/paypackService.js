let cachedToken = null;
let tokenExpiresAt = null;

/**
 * Format a phone number strictly into the local Paypack 10-digit format: 07xxxxxxxx
 * @param {string} phone
 * @returns {string} formatted phone number
 */
function formatPhoneNumber(phone) {
    if (!phone) return '';
    // Strip all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If it starts with 250, replace 250 with 0
    if (cleaned.startsWith('250')) {
        cleaned = '0' + cleaned.substring(3);
    }
    
    // If it's missing the leading 0 (e.g. 78xxxxxxx), prepend it
    if (cleaned.length === 9 && (cleaned.startsWith('78') || cleaned.startsWith('79') || cleaned.startsWith('72') || cleaned.startsWith('73'))) {
        cleaned = '0' + cleaned;
    }
    
    return cleaned;
}

function normalizeAmount(amount) {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
        throw new Error('Invalid payment amount.');
    }

    const roundedAmount = Math.round(numericAmount);

    if (roundedAmount < 1) {
        throw new Error('Payment amount must be at least 1 RWF.');
    }

    return roundedAmount;
}

/**
 * Request OAuth JWT access token from Paypack authorization endpoint.
 * Tokens are valid for 18000s (5 hours). The function caches it in-memory.
 */
async function getAccessToken() {
    if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }

    const clientId = process.env.PAYPACK_CLIENT_ID;
    const clientSecret = process.env.PAYPACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Paypack Application ID or Secret is not configured in .env variables.');
    }

    try {
        const response = await fetch('https://payments.paypack.rw/api/auth/agents/authorize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data && data.access) {
            cachedToken = data.access;
            const expiresSec = data.expires || 18000;
            // Cache token safely until 5 minutes before official expiration
            tokenExpiresAt = Date.now() + (expiresSec - 300) * 1000;
            return cachedToken;
        } else {
            throw new Error('No access token returned from Paypack authorization API.');
        }
    } catch (error) {
        console.error('Paypack Access Token Error:', error.message);
        throw new Error('Paypack access token retrieval failed: ' + error.message);
    }
}

/**
 * Initiate a push prompt (cash-in) charging the passenger's mobile money account.
 * @param {number} amount
 * @param {string} phone
 */
async function initiateCashin(amount, phone) {
    const token = await getAccessToken();
    const formattedPhone = formatPhoneNumber(phone);
    const normalizedAmount = normalizeAmount(amount);

    if (!formattedPhone || formattedPhone.length !== 10) {
        throw new Error('Invalid phone number format. Rwanda MoMo numbers must be 10 digits (e.g., 078xxxxxxx).');
    }

    try {
        const response = await fetch('https://payments.paypack.rw/api/transactions/cashin', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                amount: normalizedAmount,
                number: formattedPhone
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errorMsg = errData.message || errData.description || `HTTP error! status: ${response.status}`;
            throw new Error(errorMsg);
        }

        return await response.json(); // Contains amount, created_at, kind, ref, status
    } catch (error) {
        console.error('Paypack Cash-in Error details:', error.message);
        throw error;
    }
}

/**
 * Fetch a transaction's current state from Paypack via transaction find API.
 * @param {string} ref
 */
async function getTransactionStatus(ref) {
    const token = await getAccessToken();

    try {
        const response = await fetch(`https://payments.paypack.rw/api/transactions/find/${ref}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errorMsg = errData.message || errData.description || `HTTP error! status: ${response.status}`;
            throw new Error(errorMsg);
        }

        return await response.json(); // Contains amount, created_at, kind, ref, status
    } catch (error) {
        console.error('Paypack Find Transaction Error details:', error.message);
        throw error;
    }
}

module.exports = {
    formatPhoneNumber,
    normalizeAmount,
    getAccessToken,
    initiateCashin,
    getTransactionStatus
};
