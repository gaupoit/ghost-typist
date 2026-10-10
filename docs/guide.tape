Output guide.mp4
Output guide.gif
Set Shell zsh
Set FontSize 15
Set Width 1920
Set Height 1080
Set Padding 20
Set Framerate 24
Set TypingSpeed 35ms
Set WaitTimeout 180s

Hide
Type "cd ~/Work/typist-demo && unset $(env | grep -o '^CLAUDE_CODE_[A-Z_]*' | tr '\n' ' ') CLAUDECODE; PS1='$ '; setopt interactivecomments; clear" Enter
Sleep 500ms
Show

# Intro card
Type "# Ghost Typist: a Claude Code mod that types out the code your agent writes, live" Enter
Sleep 1s
Type "# 1. Install it inside Claude Code:" Enter
Type "#    /plugin install ghost-typist --marketplace gaupoit/ghost-typist" Enter
Sleep 2.5s

Hide
Type `clear && claude --plugin-dir ~/Work/ghost-typist --permission-mode acceptEdits` Enter
Wait+Screen /accept edits on/
Sleep 1s
Show
Sleep 1s

# 2. Open the pane
Type "/typist"
Sleep 800ms
Enter
Wait+Screen /Waiting for the agent/
Sleep 2s

# 3. Watch mode: the agent writes, the pane types
Type "Write fizzbuzz.ts: a typed fizzbuzz for 1 to 30, with a short doc comment. Nothing else."
Sleep 800ms
Enter
Wait+Screen /done · \d+ WPM · 100%/
Sleep 3s

# 4. Hacker mode: you type it
Type "/typist mode hacker"
Sleep 800ms
Enter
Wait+Screen /Hacker mode/
Sleep 2s
Escape
Sleep 500ms
Type "Now write greet.ts: greet(name) returns a friendly greeting, plus a tiny assert-based test at the bottom. Nothing else."
Sleep 800ms
Enter
Wait+Screen /hacker mode · \d+ WPM · 0%/
Ctrl+X
Tab
Sleep 800ms
Type@45ms "asdfjklasdfjklqwertyuiopzxcvbnmasdfjkl"
Sleep 400ms
Type@40ms "hjklhjklqwerasdfzxcvuiopnmhjklasdfqwertyuiop"
Sleep 300ms
Type@40ms "fjdkslafjdkslaqpwoeiruty"
Sleep 300ms
Type@35ms "asdfjklasdfjklqwertyuiopzxcvbnmasdfjklhjklhjklqwerasdfzxcvuiopnm"
Type@35ms "asdfjklasdfjklqwertyuiopzxcvbnmasdfjklhjklhjklqwerasdfzxcvuiopnm"
Type@35ms "asdfjklasdfjklqwertyuiopzxcvbnmasdfjklhjklhjklqwerasdfzxcvuiopnm"
Wait+Screen@30s /done · \d+ WPM · 100%/
Sleep 3s
Escape
Sleep 500ms

Hide
Type "/exit"
Enter
Wait /^\$/
Sleep 1s
Type `clear; printf '\033[3J\033[H\033[2J'` Enter
Sleep 500ms
Show

# Outro card
Type "# /typist                open the pane" Enter
Type "# /typist mode hacker    every letter you press types the code the agent writes" Enter
Type "# /typist sound thock    clicky, thock or off" Enter
Type "# /typist keyboard off   hide the keyboard" Enter
Type "# github.com/gaupoit/ghost-typist" Enter
Sleep 4s
