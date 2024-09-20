import { CVariables, CInventory, COwnable, CCountable, CStats, Stat, CInteractable, GameEvent, CDescriptors, CStrings }
	from "./code/raspg.js"
import { Game, Interaction, CompositeObject }
	from "./code/raspg.js"
import { Steptext }
	from "./code/steptext.js"

//# Fishing stuff
class Fish extends CompositeObject {
	static all = []
	depth
	isFish = true

	constructor(article, name, plural, minDepth, description) {
		super({identifier: name.replace(/\s/g, ''), components: [COwnable, CCountable, CDescriptors]})
		this.depth = minDepth
		this.setDescriptors(article, name, description, {plural: plural})
		this.registerPlaceholder('name', (object) => {
			return `${object.isNew? '<span class="invert">NEW</span> ' : ''}${object.$name}`
		})
		Fish.all.push(this)
	}

	static getRandom(depth=1) {
		if (depth === 0)
			depth = 1
		const chances = []
		const candidates = []
		const pickArray = [chances, candidates]
		for (const fish of this.all) {
			const distance = Math.abs(depth - fish.depth) || 1
			chances.push(Math.max(0, -(1/(200 + depth*1.5)) * Math.pow(distance, 1.5) + 10))
			candidates.push(fish)
		}
		// const chanceTotal = chances.reduce((prv, cur) => prv + cur, 0)
		// for (const i in chances)
		// 	chances[i] /= chanceTotal
		return PickOne(pickArray)
	}
}
class Discovery extends CompositeObject {
	static all = []
	static globalChanceMultiplier = 2
	depth
	fn
	maxTimes = 1
	timesFound = 0
	addToInventory
	chance
	needs

	/**
	 * @param {number} depth
	 * @param {(this: Discovery) => void} fn
	 * @param {{variance: number, maxTimes: boolean, addToInventory: boolean, chance: number, needs: (this: Discovery) => boolean}} props
	 */
	constructor(name, description, depth, fn, props={variance: 20, maxTimes: 1, addToInventory: true, chance: 1, needs: undefined}) {
		super({components: [CStrings, CDescriptors, COwnable], identifier: name})
		this.setDescriptors('', name, description)
		this.depth = depth + Math.round(Math.random() * (props.variance?? 50) - (props.variance?? 50)/2)
		this.fn = fn
		if (props.maxTimes)
			this.maxTimes = props.maxTimes
		if (props.addToInventory?? true)
			this.addToInventory = props.addToInventory?? true
		if (props.chance)
			this.chance = props.chance
		Discovery.all.push(this)
	}

	/** @type {Array<Discovery>} */
	static get eligible() {
		const eligible = this.all.filter(d =>
			(d.maxTimes > d.timesFound)
			&& (player.getVar('depth') >= d.depth)
			&& (d.needs? d.needs() : true)
			&& (d.chance? ((1-d.chance*this.globalChanceMultiplier) < Math.random()) : true)
		)
		shuffleArray(eligible)
		return eligible
	}

	find() {
		this.fn.apply(this)
		this.timesFound++
		if (this.addToInventory)
			player.giveItem(this)
	}
}

//# Access variables
const main = document.querySelector('main')
const title = document.getElementById('title')
const messages = document.getElementById('messages')
const logs = document.getElementById('logs')
const input = document.getElementById('input')
const player = new CompositeObject({identifier: 'player', components: [CVariables, CInventory, CStats, CInteractable]})
const caught = document.getElementById('caught')
const depth = document.getElementById('depth')
const follower = document.getElementById('follower')

//# Export variables to window context
window.player = player
window.Interaction = Interaction
window.Fish = Fish
window.Discovery = Discovery
window.Steptext = Steptext
window.GameEvent = GameEvent
window.CreateVisual = CreateVisual
window.SpawnShapes = SpawnShapes
window.PickOne = PickOne

//# Sounds
const ambientCutoffs = [40, 150, 400]
const ambientMaxVols = [.5,  .1,  .5]
const soundsAmbient = [
	new Howl({ src: './assets/ambiance_surface.mp3',
		html5: true, loop: true, autoplay: true, volume: ambientMaxVols[0], onunlock: function() { this.play() } }),
	new Howl({ src: './assets/ambiance_shallow.mp3',
		html5: true, loop: true, autoplay: true, volume: 0, onunlock: function() { this.play() } }),
	new Howl({ src: './assets/ambiance_deep.mp3',
		html5: true, loop: true, autoplay: true, volume: 0, onunlock: function() { this.play() } }),
]
const soundsCreak = [
	new Howl({ src: './assets/creak1.mp3',
		html5: true, volume: .5 }),
	new Howl({ src: './assets/creak2.mp3',
		html5: true, volume: .5 }),
	new Howl({ src: './assets/creak3.mp3',
		html5: true, volume: .5 }),
	new Howl({ src: './assets/creak4.mp3',
		html5: true, volume: .5 }),
	new Howl({ src: './assets/creak5.mp3',
		html5: true, volume: .5 }),
]
const soundsLamp = {
	on: new Howl({ src: './assets/lamp_on.mp3',
		html5: true, volume: .5 }),
	off: new Howl({ src: './assets/lamp_off.mp3',
		html5: true, volume: .5 }),
	hum: new Howl({ src: './assets/lamp_hum.mp3',
		html5: true, volume: .3, loop: true, autoplay: true, volume: 0, onunlock: function() { this.play() } }),
}
const soundsBump = [
	new Howl({ src: './assets/bump1.mp3',
		html5: true, volume: .7 }),
	new Howl({ src: './assets/bump2.mp3',
		html5: true, volume: .7 }),
]

//# Object instances
new Stat('power', {value: 1})
//? Fishes
new Fish('a', 'sunlight zone fish', 'sunlight zone fishes', 0, 'A fish found in the sunlight zone.')
new Fish('a', 'twilight zone fish', 'twilight zone fishes', 150, 'A fish found in the twilight zone.')
new Fish('a', 'midnight zone fish', 'midnight zone fishes', 400, 'A fish found in the midnight zone.')
new Fish('an', 'abyss zone fish', 'abyss zone fishes', 600, 'A fish found in the abyss zone.')
new Fish('an', 'eldritch fish', 'eldritch fishes', 1200, 'A fish found at incredible depths.')
// new Fish('a', 'striped bass', 0, 50, 'A powerful predator with distinctive black stripes, known for its aggressive feeding habits.')
// new Fish('a', 'tuna', 20, 50, 'Large, powerful fish with a streamlined body, often sought after for its meat.')
//? Discoveries
//* - Story items and singular treasures
new Discovery('sample container', `A reinforced metal container fitted with buoyancy devices.`, 10, function() {
	const containerInteraction = Interaction.get('container')
	player.addInteraction(containerInteraction)

	Game.out(`You find a sturdy, heavily reinforced **container** near the surface, slowly floating upwards.\n\nThe container seems to be fitted with buoyancy devices...\nPresumably for recovery in case of the loss of a vessel.\n\nYou note the discovery into your **journal**.`)
	player.addInteraction(Interaction.get('journal'))
}, { variance: 5 })
new Discovery('submarine lights', 'Lights salvaged from a submarine wreck.', 50, function() {
	Game.out(`Your sensors detect a metallic echo. Investigating, you find what looks to be a chunk of a wrecked submarine. It seems quite badly damaged, but you manage to salvage its <b>lights</b>.\n\nThe discovery makes you shiver.`)
	player.addInteraction('lights')
})
new Discovery('powerup', '', 100, function() {
	player.stats.get('power').add += 1
	this.depth += 100
}, { addToInventory: false })
//* - Oddities and easter eggs
new Discovery('"living water" sensor data', 'Sensor readings of some odd, invisible entity.', 500, function() {
	Game.out(`You feel something bump against your hull. When you turn to look, you see nothing there, but your sensors report something.\n\nYou can't shake the feeling that you're staring right at it, and it is staring back.\n\nThe sensation makes you shiver.`)
	PickOne(soundsBump).play()
}, { addToInventory: true, variance: 200, maxTimes: Infinity, chance: 0.1 })
new Discovery('water pressure anomaly', 'Sensor readings of a region of abnormally high water pressure.', 200, function() {
	Game.out(`You hear the creaking and moaning of your hull, as it flexes and readjusts under the mounting **pressure** of the water above.\n\nThe sounds make you shiver.`)
	player.addInteraction('pressure')
	player.setVar('pressure', 'Readings are elevated, and fluctuating slightly.')
	player.setVar('turnsToResetPressure', 4 + Math.round(Math.random() * 3))
	const handler = () => {
		if (player.alterVar('turnsToResetPressure', val => val-1) === 0)
			ResetPressure()
	}
	GameEvent.get('TURN').listen(handler)

	this.depth = 200 + Math.round(this.depth/200) * 200 + Math.round(Math.random()*98 - 49)
	const firstCreak = PickOne(soundsCreak)
	let secondCreak = PickOne(soundsCreak)
	while (secondCreak === firstCreak)
		secondCreak = PickOne(soundsCreak)
	firstCreak.volume(.1).play()
	setTimeout(() => secondCreak.volume(.3).play(), 3000)
	function ResetPressure() {
		player.resetVar('pressure')
		player.setVar('turnsToResetPressure', 0)
		player.alterVar('lastPressureEvent', val => player.getVar('turn'))
		Game.out(`Your hull stops creaking and moaning, having adjusted to the **pressure**.`)
		GameEvent.get('TURN').listeners.delete(handler)
		PickOne(soundsCreak).volume(.1).play()
	}
}, { addToInventory: true, variance: 0, maxTimes: Infinity, chance: 0.2, needs: () => player.getVar('turnsToResetPressure') === 0 && player.getVar('lastPressureEvent') >= 10  })
new Discovery('distant echoes', 'Recordings of distant, whimper-like echoes.', 600, function() {
	Game.out(`You hear something that sounds like a distant whimper echoing out of the depths, out of sensor range.\n\nThe sound makes you shiver.`)
	this.depth += 100 + Math.round(Math.random()*100 - 50)
}, { addToInventory: true, variance: 0, chance: 0.2, maxTimes: Infinity })
new Discovery('stars', '', 1000, async function() {
	Steptext.lock = true
	Steptext.interval = 100
	const textInterval = 2000
	Game.out(`As your hull creaks crisply, your sensors start reporting odd readings.`)
	await WaitForSteptext()
	await new Promise(r => setTimeout(r, textInterval))
	Game.out(`You look out, seeing tiny dots of light start to appear in your peripheral vision, disappearing as you turn to look.`)
	await WaitForSteptext()
	await new Promise(r => setTimeout(r, textInterval))
	Game.out(`Your core starts aching, your mind churning uncomfortably, as if the pressure pressing over your hull is now getting through.`)
	await WaitForSteptext()
	await new Promise(r => setTimeout(r, textInterval))
	Game.out(`You watch as more and more appear, now visible in the center of your vision: shimmering points of light, lining the dark abyss surrounding you.`)
	await WaitForSteptext()
	await new Promise(r => setTimeout(r, textInterval))
	Game.out(`Your core races and hums, all systems bracing; sensors keenly focused, but readings still nonsensical.`)
	Steptext.lock = false
	async function WaitForSteptext() {
		while (Steptext.queue.length)
			await new Promise(r => setTimeout(r, 50))
		return
	}
}, { addToInventory: false, variance: 0, maxTimes: Infinity })
new Discovery('timestutter', 'How can... time..', 600, async function() {
	Steptext.lock = true
	const hallucinations = [
		`<error>a</error>You caught: 999999...`,
		`<error>a</error>You caught: nothing...`,
		`<error>a</error>You caught: the head of a...`,
		`<error>a</error>You hear the creaking and...`,
		`<error>a</error>You hear something in the dee...`,
		`<error>a</error>You feel something bump...`,
		`<error>a</error>You feel as though you're being...`,
		`<error>a</error>You feel it seeping into your...`,
		`<error>a</error>You cannot shake the feeling...`,
		`<error>a</error>You cannot help but panic...`,
		`<error>a</error>You know it's waiting for you...`,
		`<error>a</error>It looms, neverending...`,
	]
	for (let i=0; i < 3; i++) {
		const hallucination = PickOne(hallucinations)
		if (i === 0)
			Game.out(hallucination)
		else
			Steptext.queue = Steptext.queue.replace(/^(.*?)(<\/div>)/, `${hallucination}$2`)
		await new Promise(r => setTimeout(r, (hallucination.length-16) * Steptext.interval))
		Steptext.element.lastElementChild.innerHTML = Steptext.element.lastElementChild.innerHTML.replace(/(<\/span>)(.*)/, `$1`)
	}
	Steptext.queue = Steptext.queue.replace(/^(.*?)(<\/div>)/, '$2')
	this.chance = player.getVar('depth')/10000 * 2
	Steptext.lock = false
}, { addToInventory: false, variance: 0, maxTimes: Infinity, chance: 0.1 })
new Discovery('hot water anomaly', 'Sensor readings of a region of abnormally hot water.', 200, function() {
	Game.out(`You hear the hull creak intermittently as it heats up, the **temperature** gauge increasing fast. Sensor reports odd readings all around.\n\nThe heat makes you sweat.`)
	player.addInteraction('temperature')
	player.setVar('temperature', 'It reads abnormally high.')
	player.setVar('turnsToResetTemperature', 5 + Math.round(Math.random() * 4 - 2))
	const handler = () => {
		if (player.alterVar('turnsToResetTemperature', val => val-1) <= 0)
			ResetTemperature()
	}
	document.body.parentElement.classList.add('hotwater')
	GameEvent.get('TURN').listen(handler)
	function ResetTemperature() {
		document.body.parentElement.classList.remove('hotwater')
		player.resetVar('temperature')
		player.setVar('turnsToResetTemperature', 0)
		player.alterVar('lastTemperatureEvent', val => player.getVar('turn'))
		Game.out(`You hear the hull creak a few more times, as the **temperature** gauge returns to frigid temperatures.`)
		GameEvent.get('TURN').unlisten(handler)
	}
}, { addToInventory: true, variance: 0, chance: 0.1, maxTimes: Infinity, needs: () => player.getVar('turnsToResetTemperature') === 0 && player.getVar('lastTemperatureEvent') >= 10 })
new Discovery('lights out', '', 450, function() {
	setTimeout(() => document.body.classList.remove('lights'), (65+10)*Steptext.interval)
	player.setVar('lightsWork', false)
	if (player.getVar('lights')) {
		soundsLamp.off.play()
		soundsLamp.hum.fade(.5, 0, 100)
	}
	player.setVar('lights', false)
	player.setVar('turnsToResetLights', Math.round(Math.random() * 10 + 10))
	Game.out(`You hear the humming of the lights sharply increase, and then a _"thunk"_. Your **lights** have malfunctioned.${this.timesFound == 0? '\n\nIn a panicked search, you manage to find an emergency **flashlight** module.' : ''}`)
	player.addInteraction('flashlight')
	const handler = () => {
		if (player.alterVar('turnsToResetLights', val => val-1) === 0)
			ResetLights()
	}
	GameEvent.get('TURN').listen(handler)
	function ResetLights() {
		player.resetVar('lightsWork')
		player.setVar('flashlight', false)
		setTimeout(() => document.body.classList.remove('flashlight'), 2000)
		Game.out(`You have managed to repair your lights. They are now operable.`)
		GameEvent.get('TURN').unlisten(handler)
	}
}, { addToInventory: false, variance: 0, chance: 0.1, maxTimes: Infinity, needs: () => player.getVar('turnsToResetLights') === 0 })
new Discovery('1238', '', 250, function() {
	Game.out(`Your sensors report readings indicating an approximately ${(Math.random()*500 + 1000).toFixed(0)}-meter tunnel opening in the seabed nearby. You feel it might be worth it to **investigate**.`)
	const investigate = Interaction.get('investigate')
	player.addInteraction(investigate)
	let caughtCount = 0
	const handler = () => {
		if (++caughtCount <= 1)
			return
		player.removeInteraction(investigate)
		GameEvent.get('CAUGHT').unlisten(handler)
	}
	GameEvent.get('CAUGHT').listen(handler)
}, { addToInventory: false, variance: 100 })
new Discovery('shadow', '', 400, function() {
	Game.out(`Your sensors report an unidentified organic mass some distance away${player.getVar('lights')? `, just out of range of your lights` : ''}. Readings indicate it is massive in size.\n\nThe thought makes you shiver.`)
	setTimeout(() => CreateVisual('shadow', 0, 1, 1000, 1, 5), Math.random() * 300 + 1000)
}, { addToInventory: 0, variance: 0, maxTimes: 5, chance: 0.1 })
new Discovery('deadzone', '', 800, function() {
	Game.out(`Your sensors go silent.\nYour gauges fall limp and motionless.\nYour lights fail and plunge you into darkness.\nYou are left blind and deaf.`)
	setTimeout(() => document.body.classList.remove('lights'), 10*Steptext.interval)
	player.setVar('lightsWork', false)
	const lightsPreviousState = player.getVar('lights')
	player.setVar('lights', false)
	player.setVar('deadzone', true)
	player.setVar('deadzoneTurns', 5 + Math.round(Math.random() * 4 - 2))
	player.setVar('temperature', 'It sits at its lowest position, unmoving.')
	player.setVar('pressure', 'It sits at its lowest position, unmoving.')
	const handler = () => {
		if (player.alterVar('deadzoneTurns', val => val-1) === 0)
			deadzoneEnd()
	}
	GameEvent.get('TURN').listen(handler)
	function deadzoneEnd() {
		player.resetVar('lightsWork')
		player.setVar('lights', lightsPreviousState)
		player.setVar('deadzone', 0)
		Game.out(`Your sensors and gauges start reporting readings again, normalizing after some time.`)
		GameEvent.get('TURN').unlisten(handler)
	}
})
//? Events
new GameEvent('TURN', () => player.alterVar('turn', val => val += 1))
new GameEvent('CAUGHT', () => {
	caught.textContent = ''+player.getVar('caught')
	GameEvent.trigger('DEPTH')
})
new GameEvent('DEPTH', () => {
	let now = Date.now()
	const start = player.getVar('depth')
	const end = player.alterVar('depth', (val) => val += player.getVar('caught')/5)
	const interval = setInterval(() => {
		depth.textContent = '' + easeInOutSine(Date.now() - now, start, end-start, 1000).toFixed(1)
		document.body.style.setProperty('--depth', easeInOutSine(Date.now() - now, start, end-start, 1000).toFixed(1))
	}, 32)
	setTimeout(() => clearInterval(interval), 1000)
	const discovery = PickOne(Discovery.eligible)
	if (discovery)
		discovery.find()
})
//? Interactions
new Interaction('fish', 'Try to catch fish.', 'fish', function(self) {
	if (player.getVar('deadzone')) {
		Game.out(`You fail to find fish in the surrounding area.`)
		GameEvent.trigger('TURN')
		return
	}
	//* Calculate fish quantity
	const quantity = player.getVar('canCatch')? Math.max(1, Math.round(
		5
		//* Fishing power
		+ self.calculateStat('power')
		//* Random variation. -3...3, -2...4, -1...5, etc.
		+ (Math.random() * (6 + self.calculateStat('power')) - 5)
	)) : 0
	console.log(`Caught ${quantity} fish.`)

	//* Give fish quantity
	self.alterVar('caught', (val) => val + quantity)

	//* Pull random fish
	const fishes = new CompositeObject({register: false, components: [CStrings, CInventory]})
	for(let i=0; i<quantity; i++)
		fishes.giveItem(Fish.getRandom(player.getVar('depth')).clone(), 1)

	//* Mark new
	for (const fish of fishes.inventory)
		if (!player.findByID(fish.id))
			fish.isNew = true
		else
			fish.isNew = false

	//* Output and event trigger
	GameEvent.trigger('CAUGHT', self, quantity)
	if (quantity == 0)
		Game.out(`You caught:\n${fishes.inventory.map(f => ` - ${f.parseString('$name')}`).join('\n')}.`)
	else
		Game.out(`You caught:\n${fishes.inventory.map(f => ` - ${f.parseString('$name')}`).join('\n')}.`)

	//* Push random fish to player inventory
	for (const fish of fishes.inventory.slice()) {
		player.giveItem(fishes.removeItem(fish), fish.count)
	}

	//* Unmark new
	for (const fish of player.inventory) {
		fish.isNew = false
	}
	GameEvent.trigger('TURN')
})
new Interaction('wait', 'Wait adrift.', 'wait', function(self) {
	Game.out(`You wait a while, adrift in the currents.`)
	GameEvent.trigger('TURN')
})
new Interaction('container', 'Investigate the metal container.', 'container', (self) => {
	const quantity = 16 + Math.round(Math.random() * 8 - 4)
	self.alterVar('caught', (val) => val += quantity)
	GameEvent.trigger('CAUGHT')
	Game.out(`You check the container you found. After prying it open, you find it contains an assortment of fishes. You note that each is tagged with a plastic tag containing its species, size and weight measurements, and what must be codes.\n\nThe discovery makes you shiver.`)
	player.removeInteraction(Interaction.get('container'))
})
new Interaction('lights', 'Turn the lights on.', /(?:toggle\s*)?lights?/i, function(self) {
	if (player.getVar('lightsWork')) {
		const lampState = self.alterVar('lights', (val) => !val)
		setTimeout(() => lampState?
			document.body.classList.add('lights')
			: document.body.classList.remove('lights')
		, 20)
		Game.out(`You turn the lights ${lampState? 'on' : 'off'}.`)
		if (lampState) {
			soundsLamp.on.play()
			setTimeout(() => soundsLamp.hum.fade(0, .5, 600), 300)
		}
		else {
			soundsLamp.off.play()
			soundsLamp.hum.fade(.5, 0, 100)
		}
		if (player.interactions.investigateCount > 0)
			player.findInteraction('investigate')
	} else
		Game.out(`Your lights are currently inoperable.`)
})
new Interaction('journal', 'Check the current haul.', /inventory|catch(?:es)?\s*log|collection|journal|logbook|fishdex|report/i, function(self) {
	Game.out(self.parseString('$inventory'))
})
new Interaction('pressure', 'Check the pressure gauge.', /(?:check\s*)?pressure(?:\s*gauge)?|gauge/i, function(self) {
	Game.out(`You check your pressure gauge. ${self.getVar('pressure')}`)
})
new Interaction('temperature', 'Check the water temperature gauge.', /(?:check\s*)?temp(?:erature)?(?:\s*gauge)?|gauge/i, function(self) {
	Game.out(`You check your temperature gauge. ${self.getVar('temperature')}`)
})
new Interaction('flashlight', 'Turn on the emergency flashlight.', /emergency\s*(?:flash)?lights?|flashlights?/i, function(self) {
	if (player.getVar('lightsWork'))
		Game.out(`You have no need for your flashlight currently.`)
	else {
		setTimeout(() => document.body.classList.toggle('flashlight'), 20)
		Game.out(`You turn your flashlight ${self.alterVar('flashlight', (val) => !val)? 'on' : 'off'}.`)
	}
})
new Interaction('help', 'See a list of available commands.', /help|commands?/i, function(self) {
	Game.out(`You assess your current situation.`)
	CreateLog('help', Array.from(player.interactions).map(i => `<b>${i.name}</b> - ${i.description}`).join('<br>'))
	document.body.classList.add('log')
})
new Interaction('investigate', 'Investigate the large tunnel.', 'investigate', function(self) {
	if (this.getVar('fishScared') && this.getVar('wallsSeen'))
		Game.out(`You find nothing else of note, and feel you should move on.`)
	else if (self.getVar('lights'))
		if (!this.getVar('fishScared')) {
			if (self.interactions.investigateCount === 0) {
				Game.out(`You approach the massive opening. Inside, you can only catch glimpses of them, as they quickly swim away from your **lights**, but there seem to be hundreds, perhaps thousands, of fish inside, each almost the size of a human.\n\nTheir movements make you shiver.`)
			} else {
				Game.out(`Your lights reveal hundreds, perhaps thousands of fish inside. As you look at them, a good portion turn to face you. Each looks to be approximately 3.2 meters long.\n\nThe sight makes you shiver.`)
				this.setVar('fishScared', true)
			}
		} else {
			Game.out(`You investigate further. The entire wall of the tunnel looks as though the rock has been chipped and chewed off.\n\nThe discovery makes you shiver.`)
			this.setVar('wallsSeen', true)
		}
	else {
		if (self.interactions.investigateCount === 0)
			Game.out(`You approach the massive opening. You can barely see with your **lights** off, but you do spot a great number of what look like eye reflections, and a myriad more of soft dots of light, presumably reflecting off of scales.`)
		else if (!this.getVar('fishScared'))
			Game.out(`You strain your eyes continuing to observe the mesmerizing display. More pairs of eyes seem to be looking your way each time you look.`)
		else
			Game.out(`You see nothing in the dark. The fish have fled further into the tunnel.`)
	}
	GameEvent.trigger('TURN')
}, {components: [CVariables]})
	.registerVariable('fishScared', false)
	.registerVariable('wallsSeen', false)

//# Player setup
player.registerPlaceholder('fishes', (self) => {
	if (self.inventory.filter(i => i.isFish).length === 0)
		return 'So far, you have caught nothing.'
	return 'So far, you have caught:\n'+self.inventory.
		filter(i => i.isFish)
		.map(f => `- ${f.parseString('$Name')} - ${f.$description}`)
		.join('\n')
})
player.registerPlaceholder('discoveries', (self) => {
	if (self.inventory.filter(d => d.maxTimes).length === 0)
		return ''
	return '\n\nYou have also found:\n'+self.inventory.
		filter(d => d.maxTimes)
		.map(d => `- ${d.parseString('$Singular')} - ${d.$description}`)
		.join('\n')
})
player.addInteraction('help')
player.addInteraction('wait')
player.addInteraction('fish')
player.setInventoryStrings('$fishes $discoveries')
player.registerStat(new Stat('power'))
player.registerVariable('turn', 0)
player.registerVariable('canCatch', true)
player.registerVariable('caught', 0)
player.registerVariable('depth', 0)
player.registerVariable('lightsWork', true)
player.registerVariable('turnsToResetLights', 0)
player.registerVariable('lights', false)
player.registerVariable('flashlight', false)
player.registerVariable('pressure', 'It reads nominal.')
player.registerVariable('turnsToResetPressure', 0)
player.registerVariable('lastPressureEvent', -1)
player.registerVariable('temperature', 'It reads nominal.')
player.registerVariable('turnsToResetTemperature', 0)
player.registerVariable('lastTemperatureEvent', -1)
player.registerVariable('deadzone', false)
player.registerVariable('deadzoneTurns', 5)

//# Framework setup
Steptext.interval = 32
Steptext.element = messages
Steptext.step()
Game.setPlayer(player)
Game.setParsingFunction((inp) => {
	player.matchInteraction(inp)
	Game.currentInput = ''
})
Game.setOutputFunction((string) => {
	//* Fade all but the latest 3 messages
	main.querySelectorAll('.msg').forEach((e, i, p) => {
		if (i > p.length - 3)
			return
		e.classList.add('fade')
	})
	// const span = document.createElement('span')
	// span.className = 'msg in'
	// setTimeout(() => span.classList.remove('in'), 300)
	// console.log(string)
	// span.innerHTML = string.replace(/\n/g, '<br>')
	// console.log(span.innerHTML)
	// input.before(span)
	let inputText = ''
	if (Game.currentInput)
		inputText = `<span class="input">${Game.currentInput}</span>`
	Game.currentInput = undefined
	Steptext.queue += `<div class="msg in">${inputText}${string}</div>`
	setTimeout(() => messages.lastElementChild.classList.remove('in'), 300)
})

//# Debugging
// Discovery.all.forEach(d => [
// 	'sample container',
// 	'submarine lights'
// ].includes(d.identifier)? d.find() : null)
// for (let i=0; i<3; i++)
// 	player.findInteraction('fish')
// Steptext.skip()
// GameEvent.trigger('DEPTH')
// player.findInteraction('lights')

//# Input registering and other setup
input.addEventListener('keypress', function(e) {
	if (e.key === 'Enter') {
		if (!Steptext.lock)
			Steptext.skip()
		Game.parse(input.value.trim().toLowerCase())
		input.value = ''
		input.setAttribute('disabled', '')
		InputWait()
		ScrollToBottom()
		function InputWait() {
			if (Steptext.queue.length || Steptext.lock)
				return requestAnimationFrame(InputWait)
			input.removeAttribute('disabled')
			input.focus()
		}
	}
})
//? Observer for new elements for sound effects?
new MutationObserver((mutationsList) => {
	const notify = ['ERROR']
	for (const m of mutationsList) {
		const notifications = Array.from(m.addedNodes).filter(e => notify.includes(e.tagName))
		if (notifications.length)
			console.log('MutationObserver notification: ', notifications)
	}
}).observe(messages, { childList: true, subtree: true })
//? Follower
main.addEventListener('mousemove', throttle((event) => {
	follower.style.setProperty('--x', `${event.pageX}px`)
	follower.style.setProperty('--y', `${event.pageY}px`)
}, 16))
document.addEventListener('mouseleave', () => follower.style.setProperty('--on', 0))
document.addEventListener('mouseenter', () => follower.style.setProperty('--on', 1))
ScrollToBottom()
ModulateBeam()
//? Scroll top
const ch = document.createElement('div')
ch.style.cssText = 'width:1ch'
main.append(ch)
main.addEventListener('scroll', () => {
	const scrollCH = main.scrollTop / ch.clientWidth
	main.style.setProperty('--scroll', main.scrollTop)
	main.style.setProperty('--scroll-ch', main.scrollTop / ch.clientWidth)
	title.style.opacity = Math.min(1, 1 - (main.scrollTop/100-1)/2)
	document.querySelectorAll('.particles').forEach(p => p.style.setProperty('--o', Math.min(1, (main.scrollTop / 100 - 5) / 50)))

	soundsAmbient.forEach((audio, i) => {
		audio.volume(Math.max(0, Math.min(ambientMaxVols[i], ambientMaxVols[i] * (
			scrollCH <= ambientCutoffs.at(i)?
				(scrollCH - (ambientCutoffs.at(i-1)?? 0)) * 1 / (ambientCutoffs.at(i) - (ambientCutoffs.at(i-1)?? 0))
				: 1 - ((scrollCH - ambientCutoffs.at(i)) * 1 / ((ambientCutoffs.at(i+1)?? 1000) - ambientCutoffs.at(i)))
		))))
	})
})
main.dispatchEvent(new Event('scroll'))
//? Fishes
function FishGen() {
	const quantity = Math.round(1 + Math.random() * 3)
	SpawnShapes('fish', quantity * 3, {
		y: Math.random() * 60 - 30,
		ySpread: 30,
		size: .3,
		sizeSpread: .4,
		ySpread: 20,
		alternateDirection: true,
		duration: 10000,
		durationSpread: 5000,
		timeSpread: 5000
	})
	setTimeout(FishGen , 4000 + Math.random() * 2000 + player.getVar('depth') * 3)
}
FishGen()

//# Helper functions
function PickOne(array) {
	if (array.length === 2 && array.every(e => e instanceof Array) && array[0].every(e => typeof(e) === 'number') && array[0].length === array[1].length) {
		const total = array[0].reduce((prv, cur) => prv + cur, 0)
		const picked = Math.random() * total
		let accum = 0
		let ret
		array[0].forEach((e, i) => {
			if (ret) return
			accum += e
			if (accum > picked)
				return ret = array[1][i]
		})
		return ret
	}
	return array.at(Math.floor(Math.random() * array.length))
}
function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}
function easeInOutSine(elapsed, initialValue, amountOfChange, duration) {
	return -amountOfChange / 2 * (Math.cos(Math.PI * elapsed / duration) - 1) + initialValue;
}
function gaussianRand() {
	let rand = 0
	for (let i=0; i<3; i++)
		rand += Math.random()
	return rand / 3
}
function throttle(mainFunction, delay) {
	let timerFlag = null; // Variable to keep track of the timer

	// Returning a throttled version 
	return (...args) => {
		if (timerFlag === null) { // If there is no timer currently running
			mainFunction(...args); // Execute the main function 
			timerFlag = setTimeout(() => { // Set a timer to clear the timerFlag after the specified delay
				timerFlag = null; // Clear the timerFlag to allow the main function to be executed again
			}, delay)
		}
	}
}
function ScrollToBottom() {
	if (Steptext.queue.length !== 0)
		main.scrollTo({top: main.scrollHeight, behavior: 'instant'})
	requestAnimationFrame(ScrollToBottom)
}
function ModulateBeam() {
	const SPAN = 36
	const INTERVAL = 1000
	document.getElementById('lights').style.setProperty('--beam-width', `${Math.round(Math.random()*SPAN-SPAN/2)}ch`)
	setTimeout(ModulateBeam, Math.random() * 500 + INTERVAL)
}
function CreateLog(title, content) {
	logs.innerHTML = ''
	const div = document.createElement('div')
	div.classList.add('msg')
	div.innerHTML = `<span class="input">${title}</span>${content}`
	const close = document.createElement('div')
	close.id = 'close'
	close.textContent = 'x'
	div.append(close)
	close.addEventListener('click', () => {
		document.body.classList.remove('log')
		setTimeout(() => logs.innerHTML = '', 1000)
	})
	logs.append(div)
}
/**
 * @param {{y: number, ySpread: number, dist: number, distSpread: number, duration: number, durationSpread: number, alternateDirection: number, size: number, sizeSpread: number, timeSpread: number}} options
 */
function SpawnShapes(type, amount=1, options={
	y: 0, ySpread: 50, dist: 0, distSpread: 3, duration: 3000, durationSpread: 500, direction: 1, alternateDirection: 1, size: 1, sizeSpread: .2, timeSpread: 2000
}) {
	const y = options.y?? 0
	const ySpread = options.ySpread?? 50
	const dist = options.dist?? 0
	const distSpread = options.distSpread?? 3
	const duration = options.duration?? 3000
	const durationSpread = options.durationSpread?? 500
	const direction = options.alternateDirection? (Math.random() < .5? 0 : 1) : options.direction?? 0
	const size = options.size?? 1
	const sizeSpread = options.sizeSpread?? 1
	const timeSpread = options.timeSpread?? 2000

	const fragment = document.createDocumentFragment()
	for (let i=0; i<amount; i++)
		fragment.append(CreateVisual(type,
			y + gaussianRand() * ySpread - ySpread/2,
			dist + Math.random() * distSpread - distSpread/2,
			duration + gaussianRand() * durationSpread - durationSpread/2,
			direction,
			size + Math.random() * sizeSpread - sizeSpread/2,
			gaussianRand() * timeSpread,
			false
		))
	main.append(fragment)
}
function CreateVisual(clss, y=0, distance=1, duration=3000, direction=1, size=1, stagger=0, append=true) {
	const div = document.createElement('div')
	div.className = clss
	div.classList.add('shape')
	div.style.setProperty('--dist', distance)
	div.style.setProperty('--dist-abs', Math.abs(distance))
	div.style.setProperty('--dir', direction)
	div.style.setProperty('--y', `${player.getVar('depth') + y}ch`)
	div.style.setProperty('--size', size)
	div.style.animationDuration = duration+'ms'
	div.style.animationDelay = stagger+'ms'
	div.style.zIndex = distance
	setTimeout(() => div.remove(), duration + stagger)
	if (!append)
		return div
	main.append(div)
}