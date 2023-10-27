process.on("message", (msg) => {
    if (msg === "exit") {
        process.exit()
    }
    process.send(msg)
})