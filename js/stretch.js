//-----------------------------------------------------------------------------
// Stretching Timer
// PL Bissell : 4/20/2023
//
// A very crude and simple timer for a group of "sessions". 
// The "Enter Session Timer" because browsers sometimes require
// user interaction before loading sound assets to prevent auto-play
// Load on "Start" would help, but it would add complexity and possibly a
// delay to the start logic. Maybe later.
//-----------------------------------------------------------------------------
// I am grateful for the use of the following sounds from freesound.org. 
// I converted to mp3 for compression.
// NC4: - https://freesound.org/people/acclivity/sounds/25882/
// CC0: - https://freesound.org/people/Sub-d/sounds/46989/
// NC3: - https://freesound.org/people/SouthernUK/sounds/141849/
//------------------------------------------------------------------------

//------------------------------------------------------------------------
// tools to produce audio asset URLs
//------------------------------------------------------------------------
const ASSET_URL_BASE = "media/snd/";
const SOUND_END_SESS   = ASSET_URL_BASE + 'D-reverse-chord.mp3';
const SOUND_START_SESS = ASSET_URL_BASE + 'Am9-guitar-chord.mp3';
const SOUND_GAP_PULSE  = ASSET_URL_BASE + 'beep-b.mp3';

//------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------
const DEBUG_STRETCH       = false;
const DEBUG_TIMER         = false; 
const BUTT_RESUME_STOPPED = 1; 
const BUTT_PAUSE_RUNNING  = 2;
const CURPOS_SESS         = 1;
const CURPOS_GAP          = 2;
const NEW_PRESET = '{ "name":"new", "sdur":35, "scnt":10, "gdur":10, "bpm":60 }';

//------------------------------------------------------------------------
// DOM Variables for interactions with UI
//------------------------------------------------------------------------
let play_button = document.getElementById("play-button");
let reset_button = document.getElementById("reset-button");
let sessions_display = document.getElementById("sessions-remaining");
let act_group = document.getElementById("act-group"); 
let act_name = document.getElementById("act-name");
let edit_preset = document.getElementById("edit-preset");
let btn_add_preset = document.getElementById("add-preset");
let txt_save_chg = document.getElementById("save-warning");
let session_cnt = document.getElementById("session-count");
let session_dur = document.getElementById("session-duration");
let gap_dur = document.getElementById("gap-duration");
let bpm_inp = document.getElementById("bpm");
let time_remaining = document.getElementById("time-remaining");
let main_form = document.getElementById("main-form");
let enter_form = document.getElementById("enter-form");
let settings_sel = document.getElementById("settings-sel");

//------------------------------------------------------------------------
// Audio streams
//------------------------------------------------------------------------
let snd_start_sess = document.createElement('audio'); 
let snd_end_sess = document.createElement('audio'); 
let snd_ping_gap = document.createElement('audio');

//------------------------------------------------------------------------
// Background colors: Start, In Session, In Gap, Paused
//------------------------------------------------------------------------
let bkg_colors_set = [ 'seagreen', 'dodgerblue', 'salmon', 'blueviolet' ];

//------------------------------------------------------------------------
// Global variables
//------------------------------------------------------------------------
var p_cursel = 0;
var p_settings = [ { "name":"morning-stretches", "sdur":35, "scnt":10, "gdur":10, "bpm":60 } ];
var p_gap_remainder = 0;
var p_cnt_remainder = 0;
var p_session_remainder = 0;
var p_timer = null;
var p_button_state = BUTT_RESUME_STOPPED; 
var p_play_state = CURPOS_GAP;
var p_first=true; 
var p_session_sound_running=false;
var p_end_sound_duration_in_seconds = 1; // how long is the end sound
var p_end_sound_duration = 1;            // how many pulses long is the end sound
var p_end_sound_start_pulse = 0;         // what pulse should the end sound be started
var p_end_sound_start_position = 0;      // what position in seconds to start sound on

//------------------------------------------------------------------------
// Initialize DOM UI elements
//------------------------------------------------------------------------
session_cnt.value=p_settings[p_cursel].scnt;
session_dur.value=p_settings[p_cursel].sdur;
gap_dur.value=p_settings[p_cursel].gdur;
bpm_inp.value=p_settings[p_cursel].bpm;

//------------------------------------------------------------------------
// This system tracks if the session parameter inputs have changed
// since the last save. It displays a notice to the user to explain that
// saving the changes happens on Start. This is a crude approach, but 
// keeps things simple in the code (no save button required).
//------------------------------------------------------------------------
var p_num_chg_state=false;
function sett_chg(reset)
{ if (reset==1) 
  { p_num_chg_state=false; 
    txt_save_chg.style.display="none";  
    return; 
  }
  if (p_num_chg_state==true) return;
  p_num_chg_state=true;
  txt_save_chg.style.display="inline-flex";  
}

//------------------------------------------------------------------------
// UI Button to rename or save preset name
//------------------------------------------------------------------------
function edit_or_save_preset()
{ if (edit_preset.value=="0") 
  { edit_preset.value="1";
    edit_preset.innerText="Save";
    act_group.style.display="block";
    btn_add_preset.style.display="none";
    act_name.value=p_settings[p_cursel].name;
  }
  else 
  { edit_preset.value="0";
    edit_preset.innerText="Rename";
    act_group.style.display="none";
    btn_add_preset.style.display="inline-flex";
    p_settings[p_cursel].name=act_name.value;
    act_name.value="";
    write_values();
    set_sett_selection(p_cursel);
  }
}

//------------------------------------------------------------------------
// Removes the current preset session parameters from the list. 
// Again, the UI is crude to keep the code simple. 
//------------------------------------------------------------------------
function del_preset()
{ if (p_settings.length==1) return;
  p_settings.splice(p_cursel, 1);
  write_values();
  set_sett_selection(0);
}

//------------------------------------------------------------------------
// The user has selected a different set of session parameters from the
// dropdown list
//------------------------------------------------------------------------
function change_preset()
{ p_cursel=settings_sel.value;
  set_sett_selection(p_cursel);
}

//------------------------------------------------------------------------
// Add a predefined activity. The new set of session parameters are defaults
// and named "New". The user can change the name and settings after.
// Again, the UI is crude to keep the code simple. 
//------------------------------------------------------------------------
function add_preset()
{ var total=p_settings.push(JSON.parse(NEW_PRESET));
  write_values();
  set_sett_selection(total-1);
  if (DEBUG_STRETCH==true) console.log("ADD PRESET: NEW CURSEL: " + p_cursel);
}

//------------------------------------------------------------------------
// The user has renamed the current session parameter set
//------------------------------------------------------------------------
function rename_current_settings(name)
{ p_sett_data[p_cursel].name=name;
  write_values();
  set_sett_selection(p_cursel);
}

//------------------------------------------------------------------------
// Change the dropdown selection UI, and 
// Load a specific set of session parameters from the list.
//------------------------------------------------------------------------
function set_sett_selection(pos)
{ settings_sel.innerHTML="";
  for (var i=0;i<p_settings.length;i++)
  { var option = document.createElement('option');
    option.value=i;
    if (i==pos) option.selected = true;
    option.text = p_settings[i].name;
    settings_sel.add(option, i);
  }
  session_dur.value = p_settings[p_cursel].sdur;
  gap_dur.value = p_settings[p_cursel].gdur;
  session_cnt.value = p_settings[p_cursel].scnt;
  bpm_inp.value = p_settings[p_cursel].bpm;
}

//------------------------------------------------------------------------
// Disable the session parameter edit capability. So the user cannot
// change the values once the timer is running. 
//------------------------------------------------------------------------
function disable_inputs(b)
{ session_cnt.disabled=b;
  session_dur.disabled=b;
  gap_dur.disabled=b;
  bpm_inp.disabled=b;
}

//------------------------------------------------------------------------
// Function to change the screen background color
//------------------------------------------------------------------------
function set_screen_color(v)
{ document.body.style.background = bkg_colors_set[v];
}

//------------------------------------------------------------------------
// The BPM field provides an easy way to change the tempo of the timer.
// Utility function to calculate beats from seconds based on current BPM
//------------------------------------------------------------------------
function convert_seconds_to_beats(s)
{ if (p_settings[p_cursel].bpm==60) return s;
  return (s/60)*p_settings[p_cursel].bpm;
}

//------------------------------------------------------------------------
// The BPM field provides an easy way to change the tempo of the timer.
// Utility function to calculate seconds from beats based on current BPM
//------------------------------------------------------------------------
function convert_beats_to_seconds(b)
{ if (p_settings[p_cursel].bpm==60) return b;
  return (b/p_settings[p_cursel].bpm)*60;
}

//------------------------------------------------------------------------
// Initialize sound variables based on audio sources.
// The end_session sound duration is important because the sound design
// intends for the end_session sound to complete at t=0
//------------------------------------------------------------------------
function setup_sounds()
{ p_end_sound_duration=0;
  p_end_sound_duration_in_seconds=0;
  snd_end_sess.src=SOUND_END_SESS;
  snd_end_sess.load();
  snd_end_sess.onloadedmetadata = function() 
  { p_end_sound_duration_in_seconds=Math.trunc(snd_end_sess.duration); 
  };
  snd_end_sess.onended = function() { p_session_sound_running=false;  };
  snd_start_sess.src=SOUND_START_SESS;
  snd_start_sess.load();
  snd_ping_gap.src=SOUND_GAP_PULSE;
  snd_ping_gap.load();
}

//------------------------------------------------------------------------
// Write the current values to localstorage for persistence, and update
// the internal settings structure with the current user input values.
// Caution: I am not careful about every case where inputs change.
//------------------------------------------------------------------------
function write_values()
{ // update p_settings with user inputs.
  p_settings[p_cursel].sdur = session_dur.value;
  p_settings[p_cursel].gdur = gap_dur.value;
  p_settings[p_cursel].scnt = session_cnt.value;
  p_settings[p_cursel].bpm = bpm_inp.value;
  localStorage.setItem("stretch.settings", JSON.stringify(p_settings));
  if (DEBUG_STRETCH==true) console.log("Writing: " + JSON.stringify(p_settings));
  sett_chg(1);
  localStorage.setItem("stretch.selected", p_cursel);
}

//------------------------------------------------------------------------
// Read the settings from local storage. If local storage is lacking,
// try to make it right. Assume that the memory values are set to 
// default (since read_values is called at startup)
//------------------------------------------------------------------------
function read_values()
{ var tmp_sett=localStorage.getItem("stretch.settings");
  var tmp_pos=localStorage.getItem("stretch.selected");
  if ((tmp_pos==null)||(tmp_sett==null)) write_values();
  else // only update if we got values from local storage
  { p_settings = JSON.parse(tmp_sett);
    p_cursel = tmp_pos;
  }
  if (DEBUG_STRETCH==true) console.log("READ VALUES: sett=" + tmp_sett + " pos=" + p_cursel);
  set_sett_selection(p_cursel);
}

//------------------------------------------------------------------------
// Display the time remaining in the current session
//------------------------------------------------------------------------
function show_time_remaining(tv)
{ if (tv==null) time_remaining.textContent = " ";
  else if (tv<10) time_remaining.textContent = " 0" + tv;
  else time_remaining.textContent = " " + tv;
}

//------------------------------------------------------------------------
// Timer handler. Runs whenever the system is active, both in session
// and in gaps between sessions.
//------------------------------------------------------------------------
function timer_handler()
{ if (DEBUG_TIMER==true) console.log("TIMER: " + p_play_state + "p_first=" + p_first + " sess_rem=" + p_session_remainder + " start_pulse=" + p_end_sound_start_pulse);

  // the first pulse/beat of a group of sessions. We set up all the timing 
  // parameters based on the current settings, which are fixed during
  // the current run.
  if (p_first==true) 
  { p_first=false;
    write_values();
    p_gap_remainder = p_settings[p_cursel].gdur;
    p_session_remainder = p_settings[p_cursel].sdur
    p_cnt_remainder = p_settings[p_cursel].scnt;
    // calculate the time is seconds where the end sound should start. complicated by bpm conversion.
    p_end_sound_duration = convert_seconds_to_beats(p_end_sound_duration_in_seconds);
    p_end_sound_start_position = p_end_sound_duration_in_seconds - convert_beats_to_seconds(p_settings[p_cursel].sdur);
    if (p_end_sound_start_position>0) p_end_sound_start_position++;
    if (p_end_sound_start_position<0) p_end_sound_start_position=0;
    if (p_settings[p_cursel].sdur>p_end_sound_duration) p_end_sound_start_pulse = p_end_sound_duration;
    else p_end_sound_start_pulse = p_settings[p_cursel].sdur-1;
    //console.log("END_SND: sec=" + p_end_sound_duration_in_seconds + " dur=" + p_end_sound_duration + " spulse=" + p_end_sound_start_pulse + " spos=" + p_end_sound_start_position);
    set_screen_color(2);
    sessions_display.textContent = "Intro " + (1+(p_settings[p_cursel].scnt-p_cnt_remainder))
  }

  // in a gap...  
  if (p_play_state==CURPOS_GAP)
  { if (--p_gap_remainder>=0) 
    { show_time_remaining(1+p_gap_remainder);
      //console.log("Play GAP SOUND " + p_gap_remainder); 
      if (snd_ping_gap) snd_ping_gap.play();
      return; // waiting for end of gap 
    }

    // START A SESSION AFTER THE COUNT
    if (DEBUG_STRETCH==true) console.log("Play Start Session SOUND " + p_session_remainder);
    if (snd_start_sess) snd_start_sess.play();
    set_screen_color(1);
    sessions_display.textContent = (1+(p_settings[p_cursel].scnt-p_cnt_remainder)) + " of " + p_settings[p_cursel].scnt;
    p_session_remainder=p_settings[p_cursel].sdur;
    p_play_state=CURPOS_SESS;
    show_time_remaining(null);
    return;
  }
  
  // in a session...
  if (p_play_state==CURPOS_SESS)
  { 
    if (--p_session_remainder>=0) 
    { show_time_remaining(1+p_session_remainder);
      
      // if this is the session pulse/beat when the end_session sound should begin, then start the sound. Sound should end at t=0
      if (p_session_remainder==p_end_sound_start_pulse) 
      { if (DEBUG_STRETCH==true) console.log("Play END SESSION SOUND - pos=" +p_end_sound_start_position + " remainder=" + p_session_remainder + " ct=" + snd_end_sess.currentTime);
        p_session_sound_running=true;
        // if (snd_end_sess) would be an error...
        snd_end_sess.play();
        snd_end_sess.currentTime = p_end_sound_start_position;
      }
      if (p_session_remainder>0) return; // waiting for end of session
    }    

    // if here, this session has completed.
    if (--p_cnt_remainder<=0) // if this is the last session in the group, then reset to Start.
    { reset_state(); 
      return;
    }

    // if here, session is over and there are sessions remaining in the group, so START A GAP/COUNT
    p_gap_remainder=p_settings[p_cursel].gdur; // reset gap remainder for new gap
    p_play_state=CURPOS_GAP;
    set_screen_color(2);
    sessions_display.textContent = "Intro " + (1+(p_settings[p_cursel].scnt-p_cnt_remainder));
    return;
  }
}

//------------------------------------------------------------------------
// Put the system is the "Start" state.
//------------------------------------------------------------------------
function reset_state()
{ if (p_button_state==BUTT_PAUSE_RUNNING) toggle_play_button();
  show_time_remaining(null);
  snd_end_sess.currentTime=0;
  play_button.textContent = "Start";
  p_play_state=CURPOS_GAP; 
  set_screen_color(0);
  sessions_display.textContent="Ready";
  p_first=true;
  disable_inputs(false);
  reset_button.style.display = "none";
}

//------------------------------------------------------------------------
// User has requested a reset after a pause.
//------------------------------------------------------------------------
function hit_reset_button()
{ reset_state();
}

//------------------------------------------------------------------------
// The start button behaves as play/pause/resume
//------------------------------------------------------------------------
function toggle_play_button()
{ if (DEBUG_STRETCH==true) console.log("BUTTON: " + p_button_state + " snd=" + p_session_sound_running + " <> pcnt=" + p_settings[p_cursel].scnt + " rem=" + p_cnt_remainder);

  // the system is running, so we must shut things down, might be pause
  if (p_button_state==BUTT_PAUSE_RUNNING)
  { p_button_state=BUTT_RESUME_STOPPED;
    if (p_timer!=null) clearTimeout(p_timer);
    p_timer=null;
    // enable input controls...
    if (p_first===true) reset_state();
    else
    { if (p_session_sound_running==true) snd_end_sess.pause();
      play_button.textContent = "Resume";
      set_screen_color(3);
      sessions_display.textContent="Continue " + (1+(p_settings[p_cursel].scnt - p_cnt_remainder));
      reset_button.style.display = "block";
    }
    return;
  }

  // either start, or the system is paused, so we must start things back up
  if (p_button_state==BUTT_RESUME_STOPPED)
  { p_button_state=BUTT_PAUSE_RUNNING;
    write_values();
    reset_button.style.display = "none";
    if (p_session_sound_running==true) snd_end_sess.play();
    disable_inputs(true);
    p_timer = setInterval(timer_handler, 1000 * convert_beats_to_seconds(1));
    play_button.textContent = "Pause";
    if (p_first==false) 
    { set_screen_color(1);
      sessions_display.textContent = (1+(p_settings[p_cursel].scnt-p_cnt_remainder)) + " of " + p_settings[p_cursel].scnt;
    }
    return;
  }
}

//------------------------------------------------------------------------
// Actions initiated by user to permit audio to play through automation
// User hit the "Enter" button on load screen
//------------------------------------------------------------------------
function enter_app()
{ main_form.style.display="flex";
  enter_form.style.display="none";
  reset_button.style.display = "none";
  read_values();
  setup_sounds();
  reset_state();
}

//------------------------------------------------------------------------
// hide the main UI in favor of start screen. 
//------------------------------------------------------------------------
main_form.style.display="none";

// EOF



