import cluster from 'node:cluster'
import { Elysia } from 'elysia'
import { exit, pid } from 'node:process'
import { node } from '@elysiajs/node'

const workersAmount = 5
const port = 3000
// Use args to differentiate paramater
// So code is more compact
const arg2 = process.argv[2]
let parameter
if (arg2 === 'port') {
	parameter = port
} else if (arg2 === 'object') {
	parameter = {
		port
	}
} else if (arg2 === 'true') {
	parameter = {
		port,
		reusePort: true
	}
} else if (arg2 === 'false') {
	parameter = {
		port,
		reusePort: false
	}
}

function shutdown(workers, code) {
	workers.forEach((it) => {
		it.kill()
	})
	exit(0)
}

if (cluster.isPrimary) {
	let workers = []
	for (let i = 0; i < workersAmount; i++) {
		workers.push(cluster.fork())
	}
	// we need some delay to allow Elysia to initialize
	const delayPromise = new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve()
		}, 2000)
	})
	await delayPromise

	// Make n API calls, we should receive n different PIDs back
	// Checking if a server is run can only be done this way at the moment
	// because error is really deep in srvx and async
	// Even callback in Elysia.listen will be still be run even on error
	const promises = workers.map(async (it) => {
		const result = await fetch(`http://localhost:${port}`)
		const pid = await result.text()
		return pid
	})
	const result = await Promise.all(promises)

	if (arg2 === 'false') {
		if (new Set(result).size != 1) {
			console.error('❌ Server should return 1 pid.')
			shutdown(workers, 1)
		}
		console.log('✅ Test succeed!')
		shutdown(workers, 0)
	}
	if (new Set(result).size != workersAmount) {
		console.error("❌ Clustering error, number of pids doesn't match.")
		shutdown(workers, 1)
	}
	console.log('✅ Test succeed!')
	shutdown(workers, 0)
} else {
	new Elysia({ adapter: node() }).get(`/`, pid).listen(parameter)
}
