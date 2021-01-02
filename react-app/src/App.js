import React, { useState } from 'react'
import ReactPlayer from 'react-player/file'

const API_BASE_URL = 'http://localhost:5000/api/'
// const FILE_SERVER = 'http://localhost:8000/'

function App() {
  const [url, setURL] = useState('');
  const [urlID, setURLID] = useState({});
  const [eta, setETA] = useState(-1);
  const [tooLong, setTooLong] = useState(0);
  const [inferHTTP, setInferHTTP] = useState(0);
  const [inferMsg, setInferMsg] = useState('');

  function getURLInfo(url) {
    setURL(url);
    var info_api_str = API_BASE_URL+ "info?url=" + url;
    fetch(info_api_str)
      .then(response => response.json())
      .then(data => {
        setURLID(data['id']);
        setETA(data['eta']);
        setTooLong(data['too_long']);
      })
      .catch(error => console.error(error));
      console.log(url, urlID, eta)
  }


  function runInference() {
    console.log('running inference for url', url);
    var infer_api_str = API_BASE_URL + "demux?url=" + url;

    const response = fetch(infer_api_str)
      .then(res => res.json())
      .then(data => {
        setInferMsg(data['msg']);
        console.log("inferMsg: ", inferMsg);
        setInferHTTP(data['status']);
        console.log("inferHTTP: ", inferHTTP);})
      .then(() => console.log("response is", inferMsg))
      .catch(error => console.error(error));
    console.log(response);
  }


  function EtaDisplay() {
    if (eta > 0) {
      return (
        <div className='eta'>
          <div className='eta-display'> ETA: {eta} </div>
          <button onClick={runInference}> Run inference </button>
        </div>
      )
    }
    return <div className='eta' />
  }


  return (
    <div className='app'>
      <Form getURLInfo={getURLInfo} />
      <EtaDisplay />
      <Player folder={inferMsg} />
    </div>
  );
}


function Form(props) {
  const getURLInfo = props.getURLInfo;
  const [userInput, setUserInput] = useState('');


  const handleChange = (e) => { setUserInput(e.target.value); };

  const handleSubmit = (e) => {
    e.preventDefault();
    getURLInfo(userInput);
  };

  return (
    <form className='user-input-form' onSubmit={handleSubmit}>
      <label>
        Youtube URL
        <input type='text' name='input-url' onChange={handleChange} />
      </label>
      <input type='submit' value="Get ETA!" />
    </form>
  )
}


function Player(props) {
  const stems = ['original', 'bass', 'drums', 'other', 'vocals']

  const folder = props.folder;
  const [playing, setPlaying] = useState(false)
  const [stemsReady, setStemsReady] = useState(0)

  const handlePlayPause = () => {
    if (folder !== '') {
      setPlaying(!playing);
    }};

  return (
    <div className='player'>
      {stems.map(stem => <Stem folder={folder} playing={playing} stem={stem} onReady={() => setStemsReady(stemsReady + 1)}/>)}
      <br/>
      <br/>
      <button onClick={handlePlayPause}> Play/Pause </button>
    </div>
  )
}


function Stem(props) {
  const {folder, stem, playing, onReady} = props;
  const [muted, setMute] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const url = folder + '/' + stem + '.mp3';

  const toggleStem = () => {
    console.log('toggling ', stem, 'from ', muted, 'to ', !muted);
    setMute(!muted); };

  const handleVolumeChange = e => {
    setVolume(parseFloat(e.target.value))
  }

  return (
    <div className={'stem-group-' + stem}>
      <button className={'stem-button-' + stem} onClick={toggleStem}> {stem} </button>

      <ReactPlayer
        className={'stem-track-' + stem}
        width='0px'
        height='1px'
        url={url}
        playing={playing}
        muted={muted}
        volume={volume}
        onReady={onReady}
        onStart={() => console.log(stem, 'Start')}
        onPause={() => console.log(stem, 'Pause')}
        onBuffer={() => console.log(stem, 'onBuffer')}
        onSeek={e => console.log('onSeek', e)}
        onError={e => console.log('onError', e)}
      />

      <input className='volume-slider' type='range' min={0} max={1} step='any' value={volume} onChange={handleVolumeChange} />
    </div>
  );
}




export default App;
