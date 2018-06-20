'use strict'

const rmfr = require('rmfr')
const tempy = require('tempy')

const initFrames = require('./init-frames')
const renderFrames = require('./render-frames')
const transcodeVideo = require('./transcode-video')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')

const noop = () => { }

const createTempWorkingDirectory = (workingDir) => {
  const dir = path.join(workingDir, crypto.randomBytes(Math.ceil(32 / 2)).toString('hex').slice(0, 32))
  fs.mkdirSync(dir)
  return dir
}

module.exports = async (opts) => {
  const {
    log = noop,
    concurrency = 4,
    frameFormat = 'raw',
    cleanupFrames = true,
    transition = undefined,
    transitions = undefined,
    audio = undefined,
    videos,
    output,
    workingDir
  } = opts

  console.time(`ffmpeg-concat`)

  const tempDir = workingDir ? createTempWorkingDirectory(workingDir) : tempy.directory()

  try {
    console.time(`init-frames`)
    const {
      frames,
      theme
    } = await initFrames({
      log,
      concurrency,
      videos,
      transition,
      transitions,
      outputDir: tempDir,
      frameFormat
    })
    console.timeEnd(`init-frames`)

    console.time(`render-frames`)
    const framePattern = await renderFrames({
      log,
      concurrency,
      outputDir: tempDir,
      frameFormat,
      frames,
      theme,
      onProgress: (p) => {
        log(`render ${(100 * p).toFixed()}%`)
      }
    })
    console.timeEnd(`render-frames`)

    console.time(`transcode-video`)
    await transcodeVideo({
      log,
      framePattern,
      frameFormat,
      audio,
      output,
      theme,
      onProgress: (p) => {
        log(`transcode ${(100 * p).toFixed()}%`)
      }
    })
    console.timeEnd(`transcode-video`)
  } catch (err) {
    if (cleanupFrames) {
      await rmfr(tempDir)
    }

    console.timeEnd(`ffmpeg-concat`)
    throw err
  }

  if (cleanupFrames) {
    await rmfr(tempDir)
  }

  console.timeEnd(`ffmpeg-concat`)
}
