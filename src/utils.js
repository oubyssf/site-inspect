const deltaT = (msDiff) => {
    const seconds = Math.floor(msDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    const remainingDays = days % 7;
    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;

    // Build the formatted string
    let parts = [];
    if (weeks > 0) parts.push(`${weeks}w`);
    if (remainingDays > 0) parts.push(`${remainingDays}d`);
    if (remainingHours > 0) parts.push(`${remainingHours}h`);
    if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
    if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);

    return '('+parts.join(" ")+")";
}

/**
 * Parse timestamp of the form yyyyMMddhhmmss
 * @param {String} timestamp - yyyyMMddhhmmss
 * @returns {Date}
 */
function parseWbTimestamp(timestamp) {
    const year = timestamp.slice(0, 4);
    const month = timestamp.slice(4, 6);
    const day = timestamp.slice(6, 8);
    const hour = timestamp.slice(8, 10);
    const minute = timestamp.slice(10, 12);
    const second = timestamp.slice(12, 14);
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
}

const isValidHttpUrl = (string) => {
    try {
        let url = new URL(string);
        if (url.protocol === 'http:' || url.protocol === 'https:') return true
        return false
    } catch (err) {
        return false;
    }
}


module.exports = { deltaT, parseWbTimestamp, isValidHttpUrl }