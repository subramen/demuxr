/* eslint-disable react/prop-types */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import AudioWave from './audiowave'
import fetch from './fetchWithTimeout'

import { styled } from '@material-ui/core/styles'
import { spacing } from '@material-ui/system'
import MuiButton from '@material-ui/core/Button'
import { LinearProgress, IconButton, Typography, Slider } from '@material-ui/core'
import PauseCircleFilledIcon from '@material-ui/icons/PauseCircleFilled'
import PlayCircleFilledIcon from '@material-ui/icons/PlayCircleFilled'
import './App.css'

const Button = styled(MuiButton)(spacing)
const server_endpoint = "/flask/file_upload"

function App () {
  // const [sessId, setSessId] = useState(0)
  // const [videoTitle, setVideoTitle] = useState("")
  const [outputUrls, setOutputUrls] = useState("")
  
  // App states:
  const [isStart, setIsStart] = useState(false)
  const [demuxRunning, setDemuxRunning] = useState(false)
  const [demuxComplete, setDemuxComplete] = useState(false)

  const resetStates = useCallback(() => {
    // console.log('resetting from ', isStart, demuxRunning, demuxComplete)
    setIsStart(false)
    setDemuxRunning(false)
    setDemuxComplete(false)
    // setSessId(Date.now())
    // console.log(sessId)
  })

  function runInference(data) {
    if (data['file'] !== null) {
      resetStates() 
      fetch(server_endpoint, { method: 'POST', body: data })
      .then(response => {
        if (response.status === 200) {
          setOutputUrls(response.stem_urls)
          setDemuxRunning(false)
          setDemuxComplete(true)
        } else {
          throw new Error('Inference failed, HTTP:', response.status)
        }
      })
    }
  }


  // function runDemuxr (url) {
  //   setIsStart(true)

  //   fetchVideoInfo(url)
  //     .then(data => {
  //       // console.log(data)
  //       // setVideoTitle(data.title)
  //       // setS3Url(data.s3_url)
  //       return data.video_id
  //     })
  //     .then((id) => {
  //       setIsStart(false)
  //       setDemuxRunning(true)
  //       console.log(id)
  //       return fetchInference(url, id)
  //     })
  //     .then(response => {
  //       console.log(response)
  //       if (response.status === 200) {
  //         setOutputUrls(response.stem_urls)
  //         setDemuxRunning(false)
  //         setDemuxComplete(true)
  //       } else {
  //         throw new Error('Inference failed, HTTP:', response.status)
  //       }
  //     })
  //     .catch(error => {
  //       console.error(error)
  //       resetStates()
  //     })
  // }

  return (
    <div className='App'>
      <div className="wrapper">
        
        <UserInput
          runInference={runInference}
          // videoTitle={videoTitle}
          isStart={isStart}
          demuxRunning={demuxRunning}
          demuxComplete={demuxComplete}
          resetStates={resetStates}/>
        

        {/* <Player key={sessId} urls={outputUrls} demuxRunning={demuxRunning} demuxComplete={demuxComplete} /> */}
        <Player urls={outputUrls} demuxRunning={demuxRunning} demuxComplete={demuxComplete} />

        <footer className="footer">
          <Typography variant="h6">
            Made with &#127927; by <a href="https://github.com/suraj813/demuxr" target="_blank" rel="noreferrer noopener">suraj813</a>
          </Typography>
        </footer>
      </div>
    </div>
  )
}

function UserInput ({ runInference, isStart, demuxRunning, demuxComplete, resetStates }) {
  const fileRef = useRef()

  const handleSubmit = (e) => {
    e.preventDefault()
    const file = fileRef.current
    const data = new FormData()
    data.append('file', file)
    runInference(data)
  }

  return (
    <div className="user-input">
      <Typography className="prompt" variant="h3" align="center"> Demuxr </Typography>
      <input type="file" accept="audio/*" className="search-bar" placeholder="Upload audio file"
      onChange={(e) => { fileRef.current = e.target.files[0] }}/>

      <div className="btn-go">
        <Button onClick={handleSubmit} px="45px" variant="contained" color="primary">Go</Button>
      </div>
      <Status isStart={isStart} demuxRunning={demuxRunning} demuxComplete={demuxComplete} />
    </div>
  )
}


function Status ({ isStart, demuxRunning, demuxComplete}) {
  let elt = null
  if (isStart) {
    elt = <LinearProgress color="secondary" variant="indeterminate" />
  } else if (demuxRunning) {
    // const msg = 'Running demuxr ' + (videoTitle ? 'on ' + videoTitle : '')
    elt = <Typography color="secondary"> Running demuxr </Typography>
  } else if (demuxComplete) {
    elt = <Typography color="secondary">Ready to play!</Typography>
  }
  return (<div className="status">{elt}</div>)
}


function Player ({ urls, demuxRunning, demuxComplete }) {
  const [playEnabled, setPlayEnabled] = useState(false)
  const stemRefs = {
    original: useRef(),
    bass: useRef(),
    drums: useRef(),
    other: useRef(),
    vocals: useRef()
  }
  const readyCountRef = useRef(0)

  // run immediately after rendering for garbage cleanup
  useEffect(() => {
    return () => Object.values(stemRefs).map(ref => {
      if (ref.current) {
        // console.log('destroying')
        ref.current.stop()
        ref.current.destroy()
        setPlayEnabled(false)
      }
    })
  }, [])

  const handleReady = () => {
    readyCountRef.current += 1
    if (readyCountRef.current >= stemRefs.length) setPlayEnabled(true)
  }

  const handlePlayPause = () => {
    Object.values(stemRefs).map(ref => ref.current.playPause())
  }

  const handleSeek = (seek) => {
    for (const [key, value] of Object.entries(stemRefs)) {
      if (key !== 'original' && value.current) {
        value.current.seekTo(seek)
      }
    }
  }

  if (!(demuxRunning || demuxComplete)) {
    return null
  } else {
    return (
      <div className='player'>
        {demuxComplete
          ? <>
            <div id="stemoriginal">
              <Stem urls={urls} id="Original" onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs.original} handleSeek={handleSeek} />
            </div>
            <div className='stemgroup'>
              <Stem urls={urls} id='Bass' onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs.bass} handleSeek={() => {}}/>
              <Stem urls={urls} id='Drums' onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs.drums} handleSeek={() => {}}/>
              <Stem urls={urls} id='Other' onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs.other} handleSeek={() => {}}/>
              <Stem urls={urls} id='Vocals' onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs.vocals} handleSeek={() => {}}/>
          </div>
          </>
          : null}

        <div className='play-btn'>
          <PlayPauseButton
            onClick={handlePlayPause}
            disabled={!playEnabled}
          />
        </div>
      </div>
    )
  }
}

function Stem ({ urls, id, onReady, demuxComplete, wavesurferRef, handleSeek }) {
  const url = urls[id.toLowerCase()]

  return (
    <div className={'stem ' + id}>
      <Typography id="stem-label" align="center" variant="h6">{id}</Typography>
      <AudioWave
        url={url}
        id={id}
        onReady={onReady}
        demuxComplete={demuxComplete}
        wavesurferRef={wavesurferRef}
        handleSeek={handleSeek}
      />
      <div className='stem-slider'>
        <Slider
          min={0} max={1}
          step={0.01}
          defaultValue={0.8}
          onChange={(e, v) => wavesurferRef.current.setVolume(v)}
          color="primary"
          aria-labelledby="label"
        />
      </div>
    </div>
  )
}

function PlayPauseButton ({ onClick, disabled }) {
  const [playing, setPlaying] = useState(false)

  const playPause = playing ? <PauseCircleFilledIcon fontSize="inherit"/> : <PlayCircleFilledIcon fontSize="inherit"/>
  return (
    <IconButton color="primary" aria-label="play/pause" onClick={() => { onClick(); setPlaying(!playing) }} disabled={disabled}>
      {playPause}
    </IconButton>
  )
}

export default App
