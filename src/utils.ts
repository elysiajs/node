import fs from 'fs'

export const withResolvers = <T>() => {
	let resolve: (value: T | PromiseLike<T>) => void
	let reject: (reason?: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve: resolve!, reject: reject! }
}

export const unwrapArrayIfSingle = <T extends unknown[]>(
	x: T
): T['length'] extends 1 ? T[0] : T => {
	if (!Array.isArray(x)) return x

	if (x.length === 1) return x[0] as any

	return x
}

export const readFileToWebStandardFile = (
	files: {
		filepath: string
		originalFilename: string
		mimetype: string
		lastModifiedDate: Date
	}[]
) => {
	const buffers = <Promise<File>[]>[]

	for (let i = 0; i < files.length; i++)
		buffers.push(
			new Promise<File>((resolve, reject) => {
				if (fs.openAsBlob)
					resolve(
						fs.openAsBlob(files[i].filepath).then(
							(blob) =>
								new File([blob], files[i].originalFilename, {
									type: files[i].mimetype,
									lastModified:
										files[i].lastModifiedDate.getTime()
								})
						)
					)
				else {
					const buffer = Array<any>()
					const stream = fs.createReadStream(files[i].filepath)

					stream.on('data', (chunk) => buffer.push(chunk))
					stream.on('end', () =>
						resolve(
							new File(
								[new Blob([Buffer.concat(buffer)])],
								files[i].originalFilename,
								{
									type: files[i].mimetype,
									lastModified:
										files[i].lastModifiedDate.getTime()
								}
							)
						)
					)
					stream.on('error', (err) =>
						reject(`error converting stream - ${err}`)
					)
				}
			})
		)

	return Promise.all(buffers)
}
