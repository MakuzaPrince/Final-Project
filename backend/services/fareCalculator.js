const calculateFare = (distanceKm) => {
    let subtotal = 0;

    if (distanceKm <= 1) {
        subtotal = 1500;
    } else if (distanceKm <= 30) {
        subtotal = 1500 + ((distanceKm - 1) * 600);
    } else {
        // First 1km = 1500
        // Next 29km = 29 * 600 = 17400
        // Remaining = (distance - 30) * 500
        subtotal = 1500 + (29 * 600) + ((distanceKm - 30) * 500);
    }

    // Tax Calculation (Assuming 18% VAT for now, adjustable)
    const TAX_RATE = 0.18;
    const taxAmount = subtotal * TAX_RATE;
    const totalFare = subtotal + taxAmount;

    return {
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        baseFare: parseFloat(subtotal.toFixed(2)),
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        totalFare: parseFloat(totalFare.toFixed(2))
    };
};

module.exports = { calculateFare };
