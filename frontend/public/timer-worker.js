self.onmessage = function (e) {
    const data = e.data;
    if (data.type === 'start') {
        const interval = data.interval || 33;
        self.intervalId = setInterval(function () {
            self.postMessage('tick');
        }, interval);
    } else if (data.type === 'stop') {
        clearInterval(self.intervalId);
    }
};
