import { resolveAudioRegister, resolveAudioValue } from './audio-command-tokens.js';
export function compileEngineAudio(data) {
    const channels = [];
    let totalCycles = 0;
    for (let channelOrder = 0; channelOrder < data.channels.length; channelOrder += 1) {
        const channel = data.channels[channelOrder];
        const compiled = compileChannel(channel);
        totalCycles = Math.max(totalCycles, compiled.totalCycles);
        channels.push(compiled);
    }
    return {
        channels,
        totalCycles,
    };
}
function compileChannel(channel) {
    const events = [];
    const controls = [];
    let currentCycle = 0;
    let loopStartCycle = null;
    for (let commandIndex = 0; commandIndex < channel.commands.length; commandIndex += 1) {
        if (channel.loopStartCommandIndex === commandIndex) {
            loopStartCycle = currentCycle;
        }
        const command = channel.commands[commandIndex];
        const instruction = command[0];
        if (instruction === 'wait') {
            currentCycle += Math.max(0, Math.floor(command[1]));
            continue;
        }
        if (instruction === 'end') {
            break;
        }
        if (instruction === 'sfx_priority') {
            controls.push({ cycle: currentCycle, commandIndex, kind: 'sfx_priority', value: command[1] });
            continue;
        }
        if (instruction === 'tempo') {
            controls.push({ cycle: currentCycle, commandIndex, kind: 'tempo', value: command[1] });
            continue;
        }
        if (instruction === 'stereo_panning' || instruction === 'force_stereo_panning') {
            controls.push({ cycle: currentCycle, commandIndex,
                kind: instruction === 'stereo_panning' ? 'panning' : 'force_panning', value: command[1] });
            events.push({ cycle: currentCycle, register: 0x25, value: command[1], channelId: channel.id });
            continue;
        }
        {
            const register = resolveAudioRegister(instruction);
            const value = resolveAudioValue(instruction, command[1]);
            if (register === 0x24)
                controls.push({ cycle: currentCycle, commandIndex, kind: 'volume', value });
            if (register === 0x25)
                controls.push({ cycle: currentCycle, commandIndex, kind: 'force_panning', value });
            events.push({
                cycle: currentCycle,
                register: register & 0xff,
                value: value & 0xff,
                channelId: channel.id,
            });
        }
    }
    if (channel.loopStartCommandIndex === channel.commands.length) {
        loopStartCycle = currentCycle;
    }
    return {
        channelId: channel.id,
        events,
        totalCycles: currentCycle,
        loopStartCycle,
        controls,
    };
}
