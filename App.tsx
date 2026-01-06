
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AppStatus, Caption, CaptionStyle } from './types';
import { extractAudioAsBase64 } from './utils/audioUtils';
import { transcribeAudio } from './services/geminiService';
import { parseWhisperLog } from './utils/parserUtils';
import { VideoPreview } from './components/VideoPreview';
import { CaptionEditor } from './components/CaptionEditor';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(localStorage.getItem('gemini_api_key') || '');

  const [style, setStyle] = useState<CaptionStyle>({
    x: 50,
    y: 85,
    fontSize: 5,
    color: '#ffffff',
    backgroundColor: '#000000aa',
    padding: 20,
    borderRadius: 8
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Persistent audio routing components
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const initAudioPipeline = useCallback(() => {
    if (!videoRef.current || audioContextRef.current) {
      // If context exists, ensure it's running
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      return;
    }
    
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = ctx.createMediaElementSource(videoRef.current);
    const destination = ctx.createMediaStreamDestination();
    
    // Route to speakers AND destination stream
    source.connect(ctx.destination);
    source.connect(destination);
    
    audioContextRef.current = ctx;
    audioSourceRef.current = source;
    audioDestinationRef.current = destination;
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', tempApiKey);
    setShowSettings(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setStatus('choosing');
  };

  const startAIProcessing = async () => {
    const key = localStorage.getItem('gemini_api_key');
    if (!key) {
      alert("Please click the gear icon in the top right to enter your Gemini API Key first.");
      setShowSettings(true);
      return;
    }
    
    if (!videoFile) return;
    setStatus('transcribing');
    try {
      const audioBase64 = await extractAudioAsBase64(videoFile);
      const transcribedCaptions = await transcribeAudio(audioBase64);
      setCaptions(transcribedCaptions);
      setStatus('editing');
    } catch (error: any) {
      console.error("Transcription failed:", error);
      alert(error.message || "Failed to transcribe. Please use manual mode.");
      setStatus('choosing');
    }
  };

  const startPastingMode = () => setStatus('pasting');
  
  const handleParseLog = () => {
    const parsed = parseWhisperLog(pastedText);
    if (parsed.length > 0) {
      setCaptions(parsed);
      setStatus('editing');
    } else {
      alert("Invalid format.");
    }
  };

  const startManualMode = () => {
    setCaptions([{ id: Date.now().toString(), start: 0, end: 3, text: 'Your first caption' }]);
    setStatus('editing');
  };

  const addNewCaption = () => {
    const id = Date.now().toString();
    const start = videoRef.current ? videoRef.current.currentTime : 0;
    const end = start + 3;
    setCaptions([...captions, { id, start, end, text: '' }]);
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const exportVideo = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    initAudioPipeline();
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    setStatus('exporting');
    setExportProgress(0);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const canvasStream = canvas.captureStream(30);
    const audioStream = audioDestinationRef.current!.stream;
    
    const combinedStream = new MediaStream([
      canvasStream.getVideoTracks()[0], 
      audioStream.getAudioTracks()[0]
    ]);
    
    const mediaRecorder = new MediaRecorder(combinedStream, { 
      mimeType: 'video/webm;codecs=vp9,opus', 
      videoBitsPerSecond: 12000000 
    });
    
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setExportedVideoUrl(URL.createObjectURL(blob));
      setStatus('completed');
      video.playbackRate = 1.0;
      video.currentTime = 0;
      
      // CRITICAL: Only stop canvas tracks. 
      // Do NOT stop audio tracks because they come from the persistent destination node.
      canvasStream.getTracks().forEach(track => track.stop());
    };

    video.currentTime = 0;
    video.muted = false;
    video.playbackRate = 1.0; 
    
    mediaRecorder.start();
    await video.play();

    const progressInterval = setInterval(() => { 
      if (video.duration) {
        setExportProgress((video.currentTime / video.duration) * 100);
      }
    }, 100);

    video.onended = async () => { 
      clearInterval(progressInterval);
      // Wait for buffer flush to ensure end of video isn't frozen
      await new Promise(resolve => setTimeout(resolve, 800));
      mediaRecorder.stop(); 
    };
  }, [initAudioPipeline]);

  return (
    <div className="h-screen flex flex-col">
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
          <div className="glass max-w-md w-full p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Gemini Settings</h2>
            <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-8 leading-relaxed">Enter your personal API key to enable AI transcription mode.</p>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] text-white/30 uppercase font-black tracking-widest">Google Gemini API Key</label>
                <input 
                  type="password" 
                  value={tempApiKey} 
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-orange-500/50 transition-all"
                  placeholder="Paste your key here..."
                />
              </div>
              <div className="flex gap-3">
                <button onClick={saveApiKey} className="flex-1 bg-orange-500 text-white py-4 rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl shadow-orange-500/20">Save Key</button>
                <button onClick={() => setShowSettings(false)} className="px-6 bg-white/5 text-white/40 rounded-full font-black uppercase text-[10px] tracking-widest">Close</button>
              </div>
              <p className="text-[8px] text-white/20 text-center uppercase tracking-widest">Get a key at <a href="https://aistudio.google.com/" target="_blank" className="text-orange-500/50 hover:text-orange-500">aistudio.google.com</a></p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-10 flex-shrink-0 z-20">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-black text-white shadow-xl shadow-orange-500/30">J</div>
          <h1 className="text-sm font-black tracking-widest text-white uppercase">JanJan<span className="text-orange-500">Cap</span></h1>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setShowSettings(true)}
            className="text-white/20 hover:text-orange-500 transition-colors p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          
          {(status === 'editing' || status === 'completed') && (
            <div className="flex gap-4">
              <button onClick={() => setStatus('idle')} className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest px-4 transition-colors">Reset</button>
              <button 
                onClick={exportVideo}
                className="bg-orange-500 hover:bg-orange-400 text-white px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-orange-500/20 active:scale-95"
              >
                Export Video
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <h2 className="text-4xl md:text-6xl font-black mb-2 tracking-tighter text-white">Drop an MP4 Video</h2>
            <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tighter text-orange-500 uppercase">Get INSTANT Captions</h2>
            
            <div className="text-white/40 text-sm md:text-base max-w-2xl mb-12 leading-relaxed">
              Use manual captions from OpenAI Whisper (Ex. <code className="bg-white/5 px-2 py-0.5 rounded font-mono text-white/60 border border-white/10">whisper "OUTPUT.mp4" --model turbo</code>) or have AI generate the captions <br/>
              <span className="text-[10px] uppercase tracking-[0.2em] font-black mt-4 block">(Note: You must provide your own Google Gemini API Key)</span>
            </div>

            <label className="cursor-pointer group">
              <div className="glass px-10 py-5 rounded-2xl border border-white/10 group-hover:border-orange-500/50 transition-all flex items-center gap-5 bg-slate-950/80 shadow-2xl">
                <div className="w-11 h-11 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-orange-500/30 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-white">Upload MP4 Video</span>
                <input type="file" accept="video/mp4" className="hidden" onChange={handleFileUpload} />
              </div>
            </label>
          </div>
        )}

        {status === 'choosing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            <h2 className="text-3xl font-black mb-10 text-white tracking-tighter uppercase">Choose Entry Point</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
              {[
                { title: 'AI Automation', sub: 'Let Gemini handle the hard work.', action: startAIProcessing, color: 'bg-orange-500' },
                { title: 'Paste Logs', sub: 'Import from Whisper exports.', action: startPastingMode, color: 'bg-white/10' },
                { title: 'Manual Build', sub: 'Complete creative control.', action: startManualMode, color: 'bg-white/10' }
              ].map((item, i) => (
                <button key={i} onClick={item.action} className="group glass p-10 rounded-[2.5rem] border border-white/5 hover:border-orange-500/50 transition-all text-left flex flex-col">
                  <div className={`w-12 h-12 ${item.color} rounded-2xl flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform`}>
                    {i === 0 ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> : (i === 1 ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6" /></svg> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" /></svg>)}
                  </div>
                  <h3 className="text-xl font-black mb-2 text-white uppercase tracking-tight">{item.title}</h3>
                  <p className="text-white/30 text-xs font-bold uppercase tracking-widest leading-relaxed">{item.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'pasting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
             <div className="w-full max-w-2xl glass p-10 rounded-[3rem] border border-white/10">
                <h2 className="text-2xl font-black mb-2 text-white uppercase tracking-tight">Paste Transcription</h2>
                <p className="text-white/30 text-[10px] uppercase font-bold tracking-widest mb-6">Format: [00:00.000 --&gt; 00:00.000] Content</p>
                <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)} className="w-full h-48 bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white font-mono outline-none focus:border-orange-500/50 mb-6" />
                <div className="flex gap-4">
                  <button onClick={handleParseLog} className="flex-1 bg-orange-500 text-white py-4 rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-orange-500/20">Analyze Log</button>
                  <button onClick={() => setStatus('choosing')} className="px-8 bg-white/5 text-white/50 rounded-full font-bold uppercase text-[10px] tracking-widest">Back</button>
                </div>
             </div>
          </div>
        )}

        {status === 'transcribing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-8"></div>
            <h2 className="text-sm font-black text-white uppercase tracking-[0.4em]">Processing Audio...</h2>
          </div>
        )}

        {(status === 'editing' || status === 'exporting' || status === 'completed') && videoUrl && (
          <div className="flex-1 flex flex-col md:flex-row p-10 gap-10">
            {/* Video Main View */}
            <div className="flex-1 flex flex-col justify-center relative">
              <VideoPreview 
                videoUrl={videoUrl} 
                captions={captions} 
                style={style} 
                onTimeUpdate={setCurrentTime} 
                onDurationChange={setDuration}
                canvasRef={canvasRef} 
                videoRef={videoRef} 
                onPlayRequest={initAudioPipeline} 
              />
              
              {status === 'exporting' && (
                <div className="absolute inset-0 z-30 glass rounded-[2rem] flex flex-col items-center justify-center p-12">
                   <div className="w-full max-w-md text-center">
                      <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse shadow-xl shadow-orange-500/20">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                      <h3 className="text-sm font-black text-white uppercase tracking-[0.4em] mb-8">Baking Video</h3>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                         <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${exportProgress}%` }}></div>
                      </div>
                      <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{Math.round(exportProgress)}% Complete</p>
                      <p className="mt-4 text-[9px] text-white/20 uppercase font-black tracking-widest">Syncing frames... Keep this window active for best results.</p>
                   </div>
                </div>
              )}

              {status === 'completed' && exportedVideoUrl && (
                <div className="absolute inset-0 z-30 glass rounded-[2rem] flex flex-col items-center justify-center p-8">
                  <div className="text-center max-w-sm">
                    <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-orange-500/40">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-3xl font-black mb-2 text-white uppercase tracking-tight leading-none">Export Success</h2>
                    <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-10">Ready for download with merged audio</p>
                    <a href={exportedVideoUrl} download="captioned_janjancap.webm" className="w-full bg-orange-500 hover:bg-orange-400 text-white py-5 rounded-full font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-orange-500/20 block">Download WebM</a>
                    <button onClick={() => setStatus('editing')} className="mt-6 text-[9px] font-black text-white/30 hover:text-white uppercase tracking-widest">Back to Editor</button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Editor */}
            <div className="w-full md:w-[26rem] flex-shrink-0 glass rounded-[2.5rem] border border-white/5 overflow-hidden">
              <CaptionEditor 
                captions={captions} 
                setCaptions={setCaptions} 
                style={style} 
                setStyle={setStyle} 
                currentTime={currentTime} 
                onAddCaption={addNewCaption} 
                onBulkImport={() => setStatus('pasting')} 
                onSeek={handleSeek}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="h-16 flex items-center justify-between px-10 flex-shrink-0 z-20">
        <a href="https://solomonchristai.substack.com/" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 hover:text-orange-400 transition-colors">Join my Substack</a>
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
           <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20">Render Node Active</span>
        </div>
        <a href="https://www.solomonchrist.com" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors">Visit My Website</a>
      </footer>
    </div>
  );
};

export default App;
