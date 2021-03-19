//https://gist.github.com/davej/728b20518632d97eef1e5a13bf0d05c7

export default function (url, timeout = 30000) {
    return Promise.race([
        fetch(url),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeout)
        )
    ]);
}