import React, { Component, useState } from 'react'
import {RecoilRoot, atom, useRecoilState, useRecoilValue } from 'recoil';
import ReactPlayer from 'react-player'

const version = 1;

const muteStatus = atom({
    key: 'mutedBass',
    default: {'bass': false, 'drums': false, 'other': false, 'vocals': false, 'original': true}}
  );

function App() {
  return (
    <RecoilRoot>
      <Player id='cpbbuaIA3Ds' />
    </RecoilRoot>
  );
}

function Player(props) {
  const id = props.id;
  const [playing, setPlaying] = useState(false)
  const handlePlayPause = () => {setPlaying(!playing)};
  const mutedStems = useRecoilValue(muteStatus);
  console.log(mutedStems);

  return (
    <div className='player'>
      <Stem id={id} playing={playing} stem='original' />
      <Stem id={id} playing={playing} stem='bass' />
      <Stem id={id} playing={playing} stem='drums' />
      <br/>
      <br/>
      <button onClick={handlePlayPause}> Play/Pause </button>
      <br/>
      <br/>
      <h2>State</h2>
      <table>
        <tbody>
            <tr><th>bass mute?</th><td>{mutedStems['bass']}</td></tr>
            <tr><th>drums mute?</th><td>{mutedStems['drums']}</td></tr>
            <tr><th>original mute?</th><td>{mutedStems['original']}</td></tr>
        </tbody>
      </table>
    </div>
  )
}


function Stem(props) {
  const {id, stem, playing} = props;
  const url = 'http://localhost:8000/' + id + '/' + stem + '.mp3';

  const [mutedStems, setMutedStems] = useRecoilState(muteStatus);
  const muted = mutedStems[stem]
  const toggleStem = () => {
    console.log('toggling ', stem, 'from ', muted, 'to ', !muted);
    const newStatus = {...mutedStems, stem: !muted}
    setMutedStems(newStatus); };

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
      onReady={() => console.log('bassReady')}
      onStart={() => console.log('bassStart')}
      onPause={() => console.log('bassPause')}
      onBuffer={() => console.log('onBuffer')}
      onSeek={e => console.log('onSeek', e)}
      onError={e => console.log('onError', e)}
      />
    </div>
  );
}


// class TrackPlayer extends Component {
//   state = {
//     url: null, // local
//     muted: false, //local
//   }

//   load = url => {
//     this.setState({
//       url,
//       played: 0,
//       loaded: 0
//     })
//   }

//   handlePlayPause = () => {
//     this.setState({ playing: !this.state.playing })
//   }

//   handleStop = () => {
//     this.setState({ url: null, playing: false })
//   }

//   handleVolumeChange = e => {
//     this.setState({ volume: parseFloat(e.target.value) })
//   }

//   handleToggleMuted = () => {
//     this.setState({ muted: !this.state.muted })
//   }

//   handlePlay = () => {
//     console.log('onPlay')
//     this.setState({ playing: true })
//   }

//   handlePause = () => {
//     console.log('onPause')
//     this.setState({ playing: false })
//   }

//   handleSeekMouseDown = e => {
//     this.setState({ seeking: true })
//   }

//   handleSeekChange = e => {
//     this.setState({ played: parseFloat(e.target.value) })
//   }

//   handleSeekMouseUp = e => {
//     this.setState({ seeking: false })
//     this.player.seekTo(parseFloat(e.target.value))
//   }

//   handleProgress = state => {
//     console.log('onProgress', state)
//     // We only want to update time slider if we are not currently seeking
//     if (!this.state.seeking) {
//       this.setState(state)
//     }
//   }

//   handleEnded = () => {
//     console.log('onEnded')
//     this.setState({ playing: this.state.loop })
//   }

//   handleDuration = (duration) => {
//     console.log('onDuration', duration)
//     this.setState({ duration })
//   }

//   renderLoadButton = (url, label) => {
//     return (
//       <button onClick={() => this.load(url)}>
//         {label}
//       </button>
//     )
//   }

//   ref = player => {
//     this.player = player
//   }

//   render () {
//     const { url, playing, controls, volume, muted, played, loaded, duration } = this.state
//     const SEPARATOR = ' · '

//     return (
//       <div className='app'>
//         <section className='section'>
//           <h1>ReactPlayer Demo</h1>
//           <div className='url-input'>
//             {this.renderLoadButton('http://localhost:8000/test.mp3', 'test')}
//           </div>
//           <div className='player-wrapper'>
//             <ReactPlayer
//               ref={this.ref}
//               className='react-player'
//               width='100%'
//               height='100%'
//               url={url}
//               playing={playing}
//               controls={controls}
//               volume={volume}
//               muted={muted}
//               onReady={() => console.log('onReady')}
//               onStart={() => console.log('onStart')}
//               onPlay={this.handlePlay}
//               onPause={this.handlePause}
//               onBuffer={() => console.log('onBuffer')}
//               onSeek={e => console.log('onSeek', e)}
//               onEnded={this.handleEnded}
//               onError={e => console.log('onError', e)}
//               onProgress={this.handleProgress}
//               onDuration={this.handleDuration}
//             />
//           </div>

//           <table>
//             <tbody>
//               <tr>
//                 <th>Controls</th>
//                 <td>
//                   <button onClick={this.handleStop}>Stop</button>
//                   <button onClick={this.handlePlayPause}>{playing ? 'Pause' : 'Play'}</button>
//                   <button onClick={this.handleClickFullscreen}>Fullscreen</button>
//                   {/* {light &&
//                     <button onClick={() => this.player.showPreview()}>Show preview</button>} */}
//                 </td>
//               </tr>
//               <tr>
//                 <th>Speed</th>
//                 <td>
//                   <button onClick={this.handleSetPlaybackRate} value={1}>1x</button>
//                   <button onClick={this.handleSetPlaybackRate} value={1.5}>1.5x</button>
//                   <button onClick={this.handleSetPlaybackRate} value={2}>2x</button>
//                 </td>
//               </tr>
//               <tr>
//                 <th>Seek</th>
//                 <td>
//                   <input
//                     type='range' min={0} max={0.999999} step='any'
//                     value={played}
//                     onMouseDown={this.handleSeekMouseDown}
//                     onChange={this.handleSeekChange}
//                     onMouseUp={this.handleSeekMouseUp}
//                   />
//                 </td>
//               </tr>
//               <tr>
//                 <th>Volume</th>
//                 <td>
//                   <input type='range' min={0} max={1} step='any' value={volume} onChange={this.handleVolumeChange} />
//                 </td>
//               </tr>
//               <tr>
//                 <th>
//                   <label htmlFor='controls'>Controls</label>
//                 </th>
//                 <td>
//                   <input id='controls' type='checkbox' checked={controls} onChange={this.handleToggleControls} />
//                   <em>&nbsp; Requires player reload</em>
//                 </td>
//               </tr>
//               <tr>
//                 <th>
//                   <label htmlFor='muted'>Muted</label>
//                 </th>
//                 <td>
//                   <input id='muted' type='checkbox' checked={muted} onChange={this.handleToggleMuted} />
//                 </td>
//               </tr>
//               <tr>
//                 <th>Played</th>
//                 <td><progress max={1} value={played} /></td>
//               </tr>
//               <tr>
//                 <th>Loaded</th>
//                 <td><progress max={1} value={loaded} /></td>
//               </tr>
//             </tbody>
//           </table>
//         </section>
//         <section className='section'>
//           <table>
//             <tbody>
//               <tr>
//                 <th>YouTube</th>
//                 <td>
//                   {this.renderLoadButton('https://www.youtube.com/watch?v=oUFJJNQGwhk', 'Test A')}
//                   {this.renderLoadButton('https://www.youtube.com/watch?v=jNgP6d9HraI', 'Test B')}
//                   {this.renderLoadButton('https://www.youtube.com/playlist?list=PLogRWNZ498ETeQNYrOlqikEML3bKJcdcx', 'Playlist')}
//                 </td>
//               </tr>
//               <tr>
//                 <th>SoundCloud</th>
//                 <td>
//                   {this.renderLoadButton('https://soundcloud.com/miami-nights-1984/accelerated', 'Test A')}
//                   {this.renderLoadButton('https://soundcloud.com/tycho/tycho-awake', 'Test B')}
//                 </td>
//               </tr>
//               <tr>
//                 <th>Facebook</th>
//                 <td>
//                   {this.renderLoadButton('https://www.facebook.com/facebook/videos/10153231379946729/', 'Test A')}
//                   {this.renderLoadButton('https://www.facebook.com/FacebookDevelopers/videos/10152454700553553/', 'Test B')}
//                 </td>
//               </tr>
//               <tr>
//                 <th>Vimeo</th>
//                 <td>
//                   {this.renderLoadButton('https://vimeo.com/90509568', 'Test A')}
//                   {this.renderLoadButton('https://vimeo.com/169599296', 'Test B')}
//                 </td>
//               </tr>
//               <tr>
//                 <th>Twitch</th>
//                 <td>
//                   {this.renderLoadButton('https://www.twitch.tv/videos/106400740', 'Test A')}
//                   {this.renderLoadButton('https://www.twitch.tv/videos/12783852', 'Test B')}
//                   {this.renderLoadButton('https://www.twitch.tv/kronovi', 'Test C')}
//                 </td>
//               </tr>
//               <tr>
//                 <th>Streamable</th>
//                 <td>
//                   {this.renderLoadButton('https://streamable.com/moo', 'Test A')}
//                   {this.renderLoadButton('https://streamable.com/ifjh', 'Test B')}
//                 </td>
//               </tr>
//               <tr>
//                 <th>Wistia</th>
//                 <td>
//                   {this.renderLoadButton('https://home.wistia.com/medias/e4a27b971d', 'Test A')}
//                   {this.renderLoadButton('https://home.wistia.com/medias/29b0fbf547', 'Test B')}
//                   {this.renderLoadButton('https://home.wistia.com/medias/bq6epni33s', 'Test C')}
//                 </td>
//               </tr>
//               <tr>
//                 <th>DailyMotion</th>
//                 <td>
//                   {this.renderLoadButton('https://www.dailymotion.com/video/x5e9eog', 'Test A')}
//                   {this.renderLoadButton('https://www.dailymotion.com/video/x61xx3z', 'Test B')}
//                 </td>
//               </tr>
//               <tr>
//                 <th>Mixcloud</th>
//                 <td>
//                   {this.renderLoadButton('https://www.mixcloud.com/mixcloud/meet-the-curators/', 'Test A')}
//                   {this.renderLoadButton('https://www.mixcloud.com/mixcloud/mixcloud-curates-4-mary-anne-hobbs-in-conversation-with-dan-deacon/', 'Test B')}
//                 </td>
//               </tr>
//               <tr>
//                 <th>Vidyard</th>
//                 <td>
//                   {this.renderLoadButton('https://video.vidyard.com/watch/YBvcF2BEfvKdowmfrRwk57', 'Test A')}
//                   {this.renderLoadButton('https://video.vidyard.com/watch/BLXgYCDGfwU62vdMWybNVJ', 'Test B')}
//                 </td>
//               </tr>
//               <tr>
//                 <th>Files</th>
//                 <td>
//                   {this.renderLoadButton('https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4', 'mp4')}
//                   {this.renderLoadButton('https://test-videos.co.uk/vids/bigbuckbunny/webm/vp8/360/Big_Buck_Bunny_360_10s_1MB.webm', 'webm')}
//                   {this.renderLoadButton('https://filesamples.com/samples/video/ogv/sample_640x360.ogv', 'ogv')}
//                   {this.renderLoadButton('https://storage.googleapis.com/media-session/elephants-dream/the-wires.mp3', 'mp3')}
//                   <br />
//                   {this.renderLoadButton('https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8', 'HLS (m3u8)')}
//                   {this.renderLoadButton('http://dash.edgesuite.net/envivio/EnvivioDash3/manifest.mpd', 'DASH (mpd)')}
//                 </td>
//               </tr>
//               <tr>
//                 <th>Custom URL</th>
//                 <td>
//                   <input ref={input => { this.urlInput = input }} type='text' placeholder='Enter URL' />
//                   <button onClick={() => this.setState({ url: this.urlInput.value })}>Load</button>
//                 </td>
//               </tr>
//             </tbody>
//           </table>

//           <h2>State</h2>

//           <table>
//             <tbody>
//               <tr>
//                 <th>url</th>
//                 <td className={!url ? 'faded' : ''}>
//                   {(url instanceof Array ? 'Multiple' : url) || 'null'}
//                 </td>
//               </tr>
//               <tr>
//                 <th>playing</th>
//                 <td>{playing ? 'true' : 'false'}</td>
//               </tr>
//               <tr>
//                 <th>volume</th>
//                 <td>{volume.toFixed(3)}</td>
//               </tr>
//               <tr>
//                 <th>played</th>
//                 <td>{played.toFixed(3)}</td>
//               </tr>
//               <tr>
//                 <th>loaded</th>
//                 <td>{loaded.toFixed(3)}</td>
//               </tr>
//             </tbody>
//           </table>
//         </section>
//         <footer className='footer'>
//           Version <strong>{version}</strong>
//           {SEPARATOR}
//           <a href='https://github.com/CookPete/react-player'>GitHub</a>
//           {SEPARATOR}
//           <a href='https://www.npmjs.com/package/react-player'>npm</a>
//         </footer>
//       </div>
//     )
//   }
// }

export default App;
