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

const API_BASE_URL = '/api/'
const INFO_API = API_BASE_URL + 'info?url='
const INFER_API = API_BASE_URL + 'demux?url='
const Button = styled(MuiButton)(spacing)

function App () {
  const [sessId, setSessId] = useState(0)
  const [videoMetaData, setVideoMetaData] = useState({})
  
  // App states:
  const [isStart, setIsStart] = useState(false)
  const [demuxRunning, setDemuxRunning] = useState(false)
  const [demuxComplete, setDemuxComplete] = useState(false)

  const resetStates = useCallback(() => {
    console.log('resetting from ', isStart, demuxRunning, demuxComplete)
    setIsStart(false)
    setDemuxRunning(false)
    setDemuxComplete(false)
    setSessId(Date.now())
    console.log(sessId)
  })

  const fetchVideoMetadata = useCallback((url) => {
    console.log('fetching info for url ', url, '...')
    return fetch(INFO_API + url).then(response => response.json())
  })

  const fetchInference = useCallback((url) => {
    console.log('running inference for url', url, '...')
    return fetch(INFER_API + url, 1200000).then(response => response.json())
  })

  function runDemuxr (url) {
    setIsStart(true)

    fetchVideoMetadata(url)
      .then(data => {
        setVideoMetaData(data)
      })
      .then(() => {
        setIsStart(false)
        setDemuxRunning(true)
        return fetchInference(url)
      })
      .then(data => {
        if (data.status === 200) {
          setDemuxRunning(false)
          setDemuxComplete(true)
        } else {
          throw new Error('Inference failed, HTTP:', data.status)
        }
        return data.status
      })
      .catch(error => {
        console.error(error)
        resetStates()
      })
  }

  return (
    <div className='App'>
      <div className="wrapper">
        <UserInput
        runDemuxr={runDemuxr}
        videoMetaData={videoMetaData}
        isStart={isStart}
        demuxRunning={demuxRunning}
        demuxComplete={demuxComplete}
        resetStates={resetStates}/>

        <Player key={sessId} folder={videoMetaData.folder} demuxRunning={demuxRunning} demuxComplete={demuxComplete} />

        <footer className="footer">
          <Typography variant="h6">
            Made with &#127927; by <a href="https://github.com/suraj813/demuxr" target="_blank" rel="noreferrer noopener">suraj813</a>
          </Typography>
        </footer>
      </div>
    </div>
  )
}

function Status (props) {
  const { isStart, demuxRunning, demuxComplete, videoMetaData } = props

  let elt = null
  if (isStart) {
    elt = <LinearProgress color="secondary" variant="indeterminate" />
  } else if (demuxRunning) {
    const msg = 'Running demuxr ' + (videoMetaData.title ? 'on ' + videoMetaData.title : '')
    elt = <Typography color="secondary"> {msg} </Typography>
  } else if (demuxComplete) {
    elt = <Typography color="secondary">Ready to play!</Typography>
  }
  return (<div className="status">{elt}</div>)
}

function UserInput ({ runDemuxr, videoMetaData, isStart, demuxRunning, demuxComplete, resetStates }) {
  const urlInputRef = useRef()

  const handleSubmit = (e) => {
    e.preventDefault()
    const url = urlInputRef.current
    if (!(url === '' || url === undefined)) {
      resetStates()
      runDemuxr(url)
    }
  }

  return (
    <div className="user-input">
      <Typography className="prompt" variant="h2" align="center"> demuxr </Typography>
      <input type="text" className="search-bar" placeholder="Paste URL here"
      onChange={(e) => { urlInputRef.current = e.target.value }}/>
      <div className="btn-go">
        <Button onClick={handleSubmit} px="45px" variant="contained" color="primary">Go</Button>
      </div>
      <Status isStart={isStart} demuxRunning={demuxRunning} demuxComplete={demuxComplete} videoMetaData={videoMetaData}/>
    </div>
  )
}

function Player ({ folder, demuxRunning, demuxComplete }) {
  console.log('<player> ', folder, demuxRunning, demuxComplete)

  const [playEnabled, setPlayEnabled] = useState(false)
  const stems = ['original', 'bass', 'drums', 'other', 'vocals']
  const stemRefs = {
    original: useRef(),
    bass: useRef(),
    drums: useRef(),
    other: useRef(),
    vocals: useRef()
  }
  const readyCountRef = useRef(0)

  useEffect(() => {
    return () => Object.values(stemRefs).map(ref => {
      if (ref.current) {
        console.log('destroying')
        ref.current.stop()
        ref.current.destroy()
        setPlayEnabled(false)
      }
    })
  }, [])

  const handleReady = () => {
    readyCountRef.current += 1
    console.log('ready ', readyCountRef.current, stems.length)
    if (readyCountRef.current >= stems.length) setPlayEnabled(true)
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

        <div id="stemoriginal">
          <Stem folder={folder} id="original" label={demuxRunning ? 'Demuxing...' : 'Original Track'} onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs.original} handleSeek={handleSeek} />
        </div>

        {demuxComplete
          ? <div className='stemgroup'>
            <Stem folder={folder} id='bass' label="Bass" onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs.bass} handleSeek={() => {}}/>
            <Stem folder={folder} id='drums' label="Drums" onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs.drums} handleSeek={() => {}}/>
            <Stem folder={folder} id='other' label="Other" onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs.other} handleSeek={() => {}}/>
            <Stem folder={folder} id='vocals' label="Vocals" onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs.vocals} handleSeek={() => {}}/>
          </div>
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

function Stem (props) {
  const { folder, id, label, onReady, demuxComplete, wavesurferRef, handleSeek } = props
  const url = folder + '/' + id + '.mp3'

  return (
    <div className={'stem ' + id}>
      <Typography id="stem-label" align="center" variant="h6">{label}</Typography>
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
