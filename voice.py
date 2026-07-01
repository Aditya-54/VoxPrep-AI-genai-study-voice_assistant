import os
import time
import asyncio
import logging
import ctypes
import numpy as np
import scipy.io.wavfile as wav
import sounddevice as sd
from dotenv import load_dotenv
import edge_tts
from faster_whisper import WhisperModel

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables from absolute path
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(script_dir, '.env'))

TEMP_RECORD_WAV = "temp_record.wav"
TEMP_TTS_MP3 = "temp_tts.mp3"
DEFAULT_VOICE = "en-US-GuyNeural"
DEFAULT_WHISPER_MODEL = "base"


def play_audio_windows(filepath: str):
    """
    Plays an MP3 or WAV file using the Windows Media Control Interface (MCI) API.
    This runs entirely locally on Windows, requires no extra dependencies like playsound
    or pygame, and doesn't launch any visible media player windows.
    """
    abs_path = os.path.abspath(filepath)
    # MCI commands require short paths if spaces are present, or wrapped double quotes
    alias = "my_audio_play"
    
    # 1. Close alias in case it was left open
    ctypes.windll.winmm.mciSendStringW(f'close {alias}', None, 0, None)
    
    # 2. Open the file
    open_cmd = f'open "{abs_path}" type mpegvideo alias {alias}'
    res = ctypes.windll.winmm.mciSendStringW(open_cmd, None, 0, None)
    if res != 0:
        logger.warning(f"MCI open command failed with code {res}. Playing audio might fail.")
        return
        
    # 3. Play the file
    ctypes.windll.winmm.mciSendStringW(f'play {alias}', None, 0, None)
    
    # 4. Block execution until the audio stops playing
    status = ctypes.create_unicode_buffer(256)
    while True:
        ctypes.windll.winmm.mciSendStringW(f'status {alias} mode', status, 256, None)
        if status.value.strip() != 'playing':
            break
        time.sleep(0.1)
        
    # 5. Clean up
    ctypes.windll.winmm.mciSendStringW(f'close {alias}', None, 0, None)


class VoiceManager:
    def __init__(self):
        self.whisper_model_name = os.getenv("WHISPER_MODEL", DEFAULT_WHISPER_MODEL)
        self.whisper_device = os.getenv("WHISPER_DEVICE", "cpu")
        self.tts_voice = os.getenv("TTS_VOICE", DEFAULT_VOICE)
        
        # Lazy load Whisper model to speed up initialization
        self._whisper_model = None

    @property
    def whisper_model(self):
        if self._whisper_model is None:
            logger.info(f"Loading local Whisper model '{self.whisper_model_name}' on device '{self.whisper_device}'...")
            try:
                # We use int8 quantization for CPU to make it fast and light
                self._whisper_model = WhisperModel(
                    self.whisper_model_name, 
                    device=self.whisper_device, 
                    compute_type="int8"
                )
            except Exception as e:
                logger.error(f"Failed to load Whisper model: {e}")
                self._whisper_model = None
        return self._whisper_model

    def speak(self, text: str):
        """
        Converts text to speech using edge-tts and plays it.
        If edge-tts fails or internet is unavailable, falls back to text printout.
        """
        print(f"\nAssistant: {text}")
        
        async def _generate_audio():
            communicate = edge_tts.Communicate(text, self.tts_voice)
            await communicate.save(TEMP_TTS_MP3)
            
        try:
            # Run async edge-tts generation synchronously
            asyncio.run(_generate_audio())
            
            # Play generated audio
            if os.path.exists(TEMP_TTS_MP3):
                play_audio_windows(TEMP_TTS_MP3)
                try:
                    os.remove(TEMP_TTS_MP3)
                except Exception:
                    pass  # file locking from MCI can occasionally delay removal
        except Exception as e:
            logger.warning(f"TTS playback failed: {e}. Falling back to visual-only display.")

    def record_voice(self, sample_rate: int = 16000) -> bool:
        """
        Records voice from the microphone using sounddevice.
        Triggers start/stop via user pressing 'Enter'.
        Saves result to temp_record.wav.
        
        Returns:
            bool: True if recording was successful and contains audio.
        """
        print("\n>>> PRESS [ENTER] TO START RECORDING YOUR ANSWER <<<")
        input()
        
        audio_data = []
        
        # Audio stream callback
        def callback(indata, frames, time, status):
            if status:
                print(status)
            audio_data.append(indata.copy())
            
        print("Recording... [ SPEAK NOW ] ... PRESS [ENTER] AGAIN TO STOP RECORDING")
        
        try:
            # Start stream (1 channel, 16-bit float)
            stream = sd.InputStream(samplerate=sample_rate, channels=1, callback=callback)
            with stream:
                input() # Block until enter key is pressed again
                
            print("Recording stopped. Processing audio...")
            
            if audio_data:
                # Concatenate all blocks of frames
                audio_np = np.concatenate(audio_data, axis=0)
                # Save as WAV file
                wav.write(TEMP_RECORD_WAV, sample_rate, audio_np)
                return True
            return False
            
        except Exception as e:
            logger.error(f"Error during audio recording: {e}")
            print("\n[Error] Could not access microphone. Make sure a microphone is connected and configured.")
            return False

    def transcribe_voice(self) -> str:
        """
        Transcribes the temp_record.wav file using faster-whisper.
        Returns transcribed text.
        """
        if not os.path.exists(TEMP_RECORD_WAV):
            logger.error("No recording file found to transcribe.")
            return ""
            
        model = self.whisper_model
        if not model:
            logger.error("Whisper model is not initialized.")
            return ""
            
        logger.info("Transcribing audio...")
        try:
            segments, info = model.transcribe(TEMP_RECORD_WAV, beam_size=5)
            transcription = "".join([segment.text for segment in segments]).strip()
            
            # Try to clean up wav file
            try:
                os.remove(TEMP_RECORD_WAV)
            except Exception:
                pass
                
            logger.info(f"Transcription complete (Language: {info.language}).")
            return transcription
            
        except Exception as e:
            logger.error(f"Error during transcription: {e}")
            return ""


# Quick diagnostic script
if __name__ == "__main__":
    vm = VoiceManager()
    vm.speak("Welcome to the voice system diagnostic test. Let's record a sample.")
    
    success = vm.record_voice()
    if success:
        text = vm.transcribe_voice()
        print(f"\nTranscribed Text: '{text}'")
        vm.speak(f"I heard you say: {text}")
    else:
        print("Recording failed.")
