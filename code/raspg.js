/** @typedef {{identifier?: string, components?: Array<Component>, register?: boolean}} ObjectProps*/
/** @typedef {{value: number, add: number, mult: number, min:number, max: number, roundToNearest: number}} StatProps */
/** @typedef {{stacks: number, turns: number}} StatusEffectProps */
/** @typedef {{name?: string, introduction?: string, description?: string, components?: Array<Component>, register?: boolean}} AreaProps */
/** @typedef {{plural: string, pronoun: string}} DescriptorProps */
/** @typedef {{string | Array<string> | RegExp}} Match */
/** @typedef {(this: CompositeObject, self: CompositeObject, ...args: any[]) => void} InteractionFunction */
/** @typedef {(this: GameEvent, triggerer: CompositeObject, ...args) => void} EventHandler */
/** @typedef {(this: CompositeObject) => void} SynergyOperation */
/** @typedef {'valueError' | 'notFound' | 'missingComponent' | 'redundantOperation'} OpFailReason */
/** @typedef {(self: CompositeObject, ...args) => void} Action */


//# MARK: Base Classes
export class CompositeObject {
	/**
	 * @desc Class instance ID index.
	 * @type {number}
	 */
	static idIndex = 0
	/**
	 * @desc Collection of all instances of this class.
	 * @type {Map<string, Object>}
	 */
	static all = new Map()
	/**
	 * @desc Unique numeric identifier.
	 * @type {number}
	 */
	id
	/**
	 * @desc Unique string identifier.
	 * @type {string}
	 */
	identifier
	/**
	 * @desc Components that have been added to the object.
	 * @type {Set<Component>}
	 */
	components = new Set()

	/**
	 * Creates a CompositeObject.
	 * @param {ObjectProps} props Initial object properties.
	 */
	constructor (props={identifier:undefined, components:[], register:true}) {
		if (props.components)
			this.addComponents(...props.components)
		if (props.register?? true)
			CompositeObject.register(this, props.identifier?? undefined)
	}

	/**
	 * Register an instance to the class' list.
	 * @param {CompositeObject} object
	 * @param {string} identifier Optional string identifier that can also be used to access the object.
	 */
	static register(object, identifier=undefined) {
		this.all.set(this.idIndex, object)
		object.id = this.idIndex
		object.identifier = identifier
		if (identifier) {
			if (this.all.has(identifier))
				throw new Error(`Identifier '${identifier}' is not unique${this.name}`)
			this.all.set(identifier, object)
			object.identifier = identifier
		}
		this.idIndex++
	}
	/**
	 * Unregister an instance from the class' list.
	 * @param {CompositeObject} object
	 */
	static unregister(object) {
		this.all.delete(object.id)
		if (object.identifier)
			this.all.delete(object.identifier)
	}
	/**
	 * Gets an instance from the class' list.
	 * @param {number | string} id The object's numeric ID or string identifier.
	 * @return {CompositeObject | null}
	 */
	static get(id) {
		if (this.all.has(id))
			return this.all.get(id)
		else return null
	}

	get isRegistered() { return typeof(this.id) === 'number' }
	get isOriginal() { return this.isRegistered && CompositeObject.all.get(this.id) === this }
	get isClone() { return this.isRegistered && CompositeObject.all.get(this.id) !== this }

	toString() {
		return `[(${this.id}) ${this.identifier?? 'no identifier'}${this.hasComponents(CCountable)? ` x ${this.count}`:''}]`
	}
	/**
	 * Adds components to the object.
	 * @param {Component} components
	 */
	addComponents(...components) {
		for (const component of components) {
			if (this.components.has(component)) continue
			component.addTo(this)
		}
		return this
	}
	/**
	 * Returns whether the object is missing any of the given components.
	 * @param  {...Component} components
	 */
	hasComponents(...components) {
		return this.components.isSupersetOf(new Set(components))
	}
	/**
	 * Creates a clone of the object.
	 */
	clone() {
		const obj = new CompositeObject({register: false})
		Object.defineProperties(obj, Object.getOwnPropertyDescriptors(CompositeObject.get(this.id)))
		obj.addComponents(...this.components)
		return obj
	}
	delete() {
		if (this.isOriginal)
			CompositeObject.unregister(this)
		this.id = null
		this.identifier = null
		for (const component of this.components)
			if (component.__delete)
				component.__delete(this)
	}
}
export class Component {
	/**
	 * @desc Components this component depends on to function. Will be added along with it, if not present.
	 * @type {Array<Component>}
	 */
	static dependencies = []
	/**
	 * @desc Operations to be executed when sets of Components are present in the same object.
	 * @type {Array<Array<Set<Component>, (object: CompositeObject) => void>>}
	 */
	static synergies = []

	/**
	 * Add the component to an object.
	 * @param {CompositeObject} objects
	 */
	static addTo(...objects) {
		if (this.dependencies.length > 0)
			for (const dependency of this.dependencies)
				for (const object of objects)
					dependency.addTo(object)
		const descriptors = Object.getOwnPropertyDescriptors(this)
		delete descriptors.prototype
		delete descriptors.length
		delete descriptors.dependencies
		delete descriptors.name
		for (const object of objects) {
			for (const [key, attributes] of Object.entries(descriptors)) {
				if (key.startsWith('__')) continue
				if (attributes.value && !(attributes.value instanceof Function))
					attributes.value = structuredClone(attributes.value)
				// if (attributes.value && attributes.value instanceof Function)
				// 	attributes.value = (...args) => this[key].apply(object, args)
				Object.defineProperty(object, key, attributes)
			}
			object.components?.add(this)
			if (this.__postAddition)
				this.__postAddition(object)
			Synergy.evaluate(object, this)
		}
	}
}
export class Synergy {
	static all = []
	components = new Set()
	operation

	/**
	 * @param {Array<Component>} components
	 * @param {SynergyOperation} operation
	 */
	constructor(components, operation) {
		this.components = new Set(components)
		this.operation = operation
	}

	/**
	 * Register a new component synergy.
	 * @param {Array<Component>} components
	 * @param {SynergyOperation} operation
	 */
	static register(components, operation) {
		if (components.length < 2)
			throw new Error(`Synergies require 2 or more Components`)
		this.all.push(new Synergy(components, operation))
		return this
	}
	/**
	 * Evaluates what synergies are applicable to the object and applies them.
	 * @param {CompositeObject} object
	 * @param {Component} lastAdded Last Component added to the object. Used to pick which Synergies should be applied.
	 */
	static evaluate(object, lastAdded) {
		const applicableSynergies = this.all.filter(s => {
			const synergyComponentSet = new Set(s.components)
			return object.components?.isSupersetOf(synergyComponentSet)
			&& (
				object.components
					?.intersection(synergyComponentSet)
					.difference(new Set([lastAdded]))
					.size
				=== synergyComponentSet.size-1
			)
		})
		for (const synergy of applicableSynergies)
			synergy.operation.apply(object)
	}
}
export class GameEvent {
	/**
	 * @desc Collection of all instances of this class.
	 * @type {Map<string, Object>}
	 */
	static all = new Map()
	/**
	 * @desc The event's name and identifier.
	 * @type {string}
	 */
	name
	/**
	 * @desc The event's handler.
	 * @type {EventHandler}
	 */
	fn
	/**
	 * @desc Array of strings describing the arguments required by the event. Only for help debugging, not strictly required.
	 * @type {EventHandler}
	 */
	arguments = []
	/**
	 * @desc Array of functions listening to the event.
	 * @type {Array<EventHandler>}
	 */
	listeners = new Set()
	/**
	 * @desc How many times the event has been triggered.
	 * @type {number}
	 */
	timesTriggered = 0

	/**
	 * Creates an event.
	 * @param {string} name Name and identifier.
	 * @param {EventHandler} fn
	 * @param {boolean} register
	 */
	constructor(name, fn, args=[], register=true) {
		this.name = name
		this.fn = fn
		if (args?? false)
			this.arguments = args
		if (register?? true)
			GameEvent.register(this)
	}

	/**
	 * Register an instance to the class' list.
	 * @param {GameEvent} event
	 */
	static register(event) {
		if (this.all.has(event.name))
			throw new Error(`Identifier '${event.name}' is not unique`)
		else
			this.all.set(event.name, event)
	}
	/**
	 * Unregister an instance from the class' list.
	 * @param {GameEvent} event
	 */
	static unregister(event) {
		this.all.delete(event.name)
	}
	/**
	 * Gets an instance from the class' list.
	 * @param {number | string} name
	 * @return {GameEvent | null}
	 */
	static get(name) {
		if (this.all.has(name))
			return this.all.get(name)
		else return null
	}
	/**
	 * Trigger an event by name.
	 * @param {string} name
	 * @param {CompositeObject} triggerer Object triggering the event.
	 * @param {...any} args Arguments required by the Event.
	 */
	static trigger(name, triggerer, ...args) {
		if (!this.all.has(name))
			throw new Error(`Trying to trigger unexistent event '${name}'`)
		this.get(name).trigger(triggerer, ...args)
	}

	/**
	 * Triggers the event.
	 * @param {CompositeObject} triggerer Object triggering the event.
	 * @param {...any} args Arguments required by the Event.
	 */
	trigger(triggerer, ...args) {
		if (this.arguments && args.length < this.arguments)
			throw new Error(`Trying to trigger event '${this.name}' with insufficient arguments. Arguments required: ${this.arguments.join(', ')}`)
		this.timesTriggered++
		if (this.fn)
			this.fn.apply(this, [triggerer, ...args])
		for (const listener of this.listeners)
			listener.apply(this, [triggerer, ...args])
	}
	/**
	 * Register a handler function to be triggered with this event.
	 * @param {EventHandler} fn
	 */
	listen(fn) {
		this.listeners.add(fn)
	}
	/**
	 * Unregister a handler function from being triggered with this event.
	 * @param {EventHandler} fn
	 */
	unlisten(fn) {
		this.listeners.delete(fn)
	}
}
export class Stat {
	/**
	 * @desc The map of calculations used by different stats.
	 * @type {Map<string, (this: Stat) => number>}
	 */
	static calculations = new Map([
		['default', function(stat) {return stat.value + stat.add + stat.value * stat.mult}]
	])
	/**
	 * @desc The map of Stat prototypes, with their respective default values.
	 * @type {Map<string, (this: Stat) => number>}
	 */
	static prototypes = new Map()
	/**
	 * @desc The stat's name.
	 * @type {string}
	 */
	name
	/**
	 * @desc The stat's current base value.
	 * @type {number}
	 */
	value
	/**
	 * @desc The flat addition modifier to the stat. Not multiplied by `mult`.
	 * @type {number}
	 */
	add
	/**
	 * @desc The multiplying modifier to the stat. Multiplies `value`. Identity (non-altering) value is 0; +100% is 1.
	 * @type {number}
	 */
	mult
	/**
	 * @desc The stat's minimum value.
	 * @type {number}
	 */
	min
	/**
	 * @desc The stat's maximum value.
	 * @type {number}
	 */
	max
	/**
	 * @desc To which nearest numerical value the stat should be rounded to when calculated.
	 * @type {number}
	 */
	roundToNearest
	/**
	 * @desc Key for the calculation to be used when calculating a final value for the Stat.
	 * @type {number}
	 */
	calculationKey


	/**
	 * Creates a new Stat instance. If there's an existing prototype under `name`, a copy of it will be returned with its properties replaced by present arguments.
	 * @param {string} name
	 * @param {StatProps} defaults
	 * @param {number} calculationKey Key for the calculation to be used when calculating a final value for the Stat.
	 */
	constructor(name, defaults={value: 0, add: 0, mult: 0, min:0, max: Number.MAX_VALUE, roundToNearest: 1}, calculationKey='default') {
		const original = Stat.prototypes.get(name)
		if (original) {
			this.value = original.value
			this.add = original.add
			this.mult = original.mult
			this.min = original.min
			this.max = original.max
			this.roundToNearest = original.roundToNearest
			this.calculationKey = original.calculationKey
		}
		this.name = name
		this.value = defaults.value?? 0
		this.add = defaults.add?? 0
		this.mult = defaults.mult?? 0
		this.min = defaults.min?? 0
		this.max = defaults.max?? Number.MAX_VALUE
		this.roundToNearest = defaults.roundToNearest?? 1
		this.calculationKey = calculationKey
		Stat.prototypes.set(name, this)
	}

	/**
	 * Returns a final value for the stat.
	 * @param {boolean} round Whether the value should be rounded according to the Stat's properties. Defaults to `true`.
	 */
	calculate(round=true) {
		let result = Stat.calculations.get(this.calculationKey?? 'default')(this)
		if (round)
			if (this.roundToNearest === 1)
				result = Math.round(result)
			else
				result = Math.round(result / this.roundToNearest) * this.roundToNearest
		result = Math.max(this.min, Math.min(result, this.max))
		return result
	}
	/**
	 * Creates a new Stat instance using this as a template.
	 * @param {StatProps} values Unset values will use the current instance's value.
	 */
	copy(values={value: this.value, add: this.add, mult: this.mult, min:0, max: this.max, roundToNearest: this.roundToNearest}) {
		const newStat = new Stat(this.name)
		newStat.name = values.name?? this.name
		newStat.value = values.value?? this.value
		newStat.add = values.add?? this.add
		newStat.mult = values.mult?? this.mult
		newStat.min = values.min?? this.min
		newStat.max = values.max?? this.max
		newStat.roundToNearest = values.roundToNearest?? this.roundToNearest
		return newStat
	}
}
export class StatusEffect {
	/**
	 * @desc The map of StatusEffects prototypes, with their respective default values.
	 * @type {Map<string, (this: Stat) => number>}
	 */
	static prototypes = new Map()
	name
	description
	stacks
	turns
	statModifier

	/**
	 * Creates a new StatusEffect instance. If there's an existing prototype under `name`, a copy of it will be returned with its properties replaced by values in the `defaults` argument.
	 * @param {string} name
	 * @param {StatusEffectProps} defaults
	 */
	constructor(name, defaults={stacks: 1, turns: 1}) {
		const original = StatusEffect.prototypes.get(name)
		if (original) {
			this.stacks = original.stacks
			this.turns = original.turns
		}
		this.name = name
		this.stacks = defaults.stacks
		this.turns = defaults.turns
		StatusEffect.prototypes.set(name, this)
	}
	/**
	 * Creates a new StatusEffect instance using this as a template.
	 * @param {StatusEffectProps} values Unset values will use the current instance's value.
	 */
	copy(values={stacks: 1, turns: 1}) {
		const newStatusEffect = new StatusEffect(this.name)
		newStatusEffect.stacks = values.stacks?? this.stacks
		newStatusEffect.turns = values.turns?? this.turns
		return newStatusEffect
	}
}
export class OperationFail {
	/**
	 * @desc Whether all failures should be logged.
	 * @type {boolean}
	 */
	static logAll = true
	/**
	 * @desc At what level all failures should be logged at when `logAll` is true.
	 * @type {'info' | 'warn' | 'error'}
	 */
	static logAllAs = 'warn'
	/**
	 * @desc The object relevant to the failed operation.
	 * @type {CompositeObject}
	 */
	object
	/**
	 * @desc Brief string describing the reason why the operation failed.
	 * @type {OpFailReason}
	 */
	reason
	/**
	 * @desc Error object including provided message and stack trace.
	 * @type {OpFailReason}
	 */
	error

	/**
	 * @param {CompositeObject} object The object relevant to the failed operation.
	 * @param {OpFailReason} reason Brief string describing the reason why the operation failed.
	 */
	constructor(operation, object, reason, message) {
		this.operation = operation
		this.object = object
		this.reason = reason
		this.error = new Error(`${operation} - ${object} - ${reason}\n${message}`)
		if (OperationFail.logAll)
			this.log(OperationFail.logAllAs)
	}

	/**
	 * Log the operation's properties, message and stack trace to the console.
	 * @param {'info' | 'warn' | 'error'} level Log level. Defaults to `'warn'`.
	 */
	log(level='warn') {
		console[level](this.error)
	}
}
//# MARK: CompositeObjects
export class Interaction extends CompositeObject {
	/**
	 * @desc Collection of all instances of this class.
	 * @type {Map<string, Object>}
	 */
	static all = new Map()
	/**
	 * @desc Interaction name. Conventionally a verb describing what it does.
	 * @type {string}
	 */
	name
	/**
	 * @desc A short description for the interaction.
	 * @type {string}
	 */
	description
	/**
	 * @desc Function that consists the interaction itself.
	 * @type {InteractionFunction}
	 */
	fn

	/**
	 * Creates an Interaction.
	 * @param {string} name Interaction name. Conventionally a verb describing what it does.
	 * @param {string} description A short description for the interaction.
	 * @param {Match} match What input(s) should match the interaction.
	 * @param {InteractionFunction} fn Function that consists the interaction itself.
	 * @param {ObjectProps} props Initial object properties.
	 */
	constructor(name, description, match, fn, props={identifier:undefined, components:[], register:true}) {
		super({identifier: props.identifier?? `interaction_${name}`, components: props.components, register: props.register?? true})
		this.addComponents(CMatch)
		this.name = name
		this.description = description
		this.match = match
		this.fn = fn
		if (props.register?? true)
			Interaction.register(this, props.identifier?? name)
	}

	/**
	 * Register an instance to the class' list.
	 * @param {Interaction} interaction
	 */
	static register(interaction) {
		if (this.all.has(interaction.name))
			throw new Error(`Identifier '${interaction.name}' is not unique`)
		this.all.set(interaction.name, interaction)
	}
	/**
	 * Unregister an instance from the class' list.
	 * @param {Interaction} interaction
	 */
	static unregister(interaction) {
		this.all.delete(interaction.id)
		if (interaction.identifier)
			this.all.delete(interaction.identifier)
	}
	/**
	 * Gets an instance from the class' list.
	 * @param {number | string} id The object's numeric ID or string identifier.
	 * @return {Interaction | null}
	 */
	static get(id) {
		if (this.all.has(id))
			return this.all.get(id)
		else return null
	}
	/**
	 * Call the interaction using `object` as the `this`.
	 * @param {CompositeObject} object
	 */
	callFrom(object, ...args) {
		this.fn(object, ...args)
		if (object.hasComponents(CInteractable))
			object.interactions[`${this.name}Count`] += 1
	}
	delete() {
		Interaction.unregister(this)
		CompositeObject.all.forEach(object => {
			if (object.hasComponents(CInteractable))
				object.removeInteraction(this)
		})
		super.delete()
	}
}
export class Area extends CompositeObject {
	/**
	 * @desc Collection of all instances of this class.
	 * @type {Map<string, Object>}
	 */
	static all = new Map()
	/**
	 * @desc Array comprising of areas this area connects to.
	 * @type {Array<Area>}
	 */
	connections = []
	/**
	 * @desc Times the area has been visited.
	 * @type {number}
	 */
	visited = 0

	/**
	 * Creates an area object.
	 * @param {string} identifier
	 * @param {AreaProps} props
	 */
	constructor(identifier, props={name:'', introduction:'', description:'', components:[], register:true}) {
		super({identifier: `area_${identifier}`, components: props.components?? [], register: props.register?? true})
		this.addComponents(CStrings, CInventory)
		this.setString('name', props.name?? identifier)
		this.registerShorthand('name')
		if (props.introduction?? false) {
			this.setString('intro', props.introduction)
			this.registerShorthand('intro')
		}
		if (props.description?? false) {
			this.setString('description', props.description)
			this.registerShorthand('description')
		}
		if (props.register?? true)
			Area.register(this)
	}

	/**
	 * Register an instance to the class' list.
	 * @param {Area} area
	 */
	static register(area) {
		if (this.all.has(area.identifier))
			throw new Error(`Identifier '${area.identifier}' is not unique`)
		this.all.set(area.identifier, area)
	}
	/**
	 * Unregister an instance from the class' list.
	 * @param {Area} area
	 */
	static unregister(area) {
		this.all.delete(area.id)
		if (area.identifier)
			this.all.delete(area.identifier)
	}
	/**
	 * Gets an instance from the class' list.
	 * @param {number | string} id The object's numeric ID or string identifier.
	 * @return {Area | null}
	 */
	static get(id) {
		if (this.all.has(id))
			return this.all.get(id)
		else return null
	}

	/**
	 * Adds an area to this area's connections.
	 * @param {Area} area
	 * @param {boolean} twoway Whether the connection should be added from the other side. Defaults to `false`.
	 */
	addConnection(area, twoway=false) {
		if (this.connections.includes(area)) {
			console.warn(`Trying to add existing connection between '${this.identifier}' and '${area.identifier}'`)
			return this
		}
		this.connections.push(area)
		this.connections[area.identifier] = area
		if (twoway)
			area.addConnection(this)
		return this
	}
	/**
	 * Removes an area from this area's connections.
	 * @param {Area} area
	 * @param {boolean} twoway Whether the connection should be removed from the other side. Defaults to `false`.
	 */
	removeConnection(area, twoway=false) {
		if (!this.connections.includes(area)) {
			console.warn(`Trying to remove nonexistent connection between '${this.identifier}' and '${area.identifier}'`)
			return this
		}
		this.connections.splice(this.connections.indexOf(area), 1)
		delete this.connections[area.identifier]
		if (twoway)
			area.removeConnection(this)
		return this
	}
	delete() {
		Area.unregister(this)
		for (const object of this.inventory)
			object.delete()
		super.delete()
	}
}
//# MARK: Components
export class CMatch extends Component {
	/**
	 * @desc A string, list of strings, or RegExp rule describing what inputs should match the object. If an array, ideally from most specific/longest to least specific/shortest.
	 * @type {string | Array<string> | RegExp}
	 */
	static match

	/**
	 * Returns the result of matching the input string to the object's `match`.
	 * @param {string} input
	 * @returns {RegExpMatchArray}
	 */
	static matchAgainst(input) {
		if (this.match instanceof Array)
			return input.match(this.match.find(e => input.match(e)))
		return input.match(this.match)
	}
}
export class CTags extends Component {
	/**
	 * @desc Strings describing properties of the object. Conventionally uppercase.
	 * @type {Set<String>}
	 */
	static tags = new Set()

	/**
	 * Adds given tag to object.
	 * @param {string} tag
	 * @this {CompositeObject}
	 */
	static addTag(tag) {
		this.tags.add(tag)
		return this
	}
	/**
	 * Adds given tags to object.
	 * @param  {Array<string>} tags
	 * @this {CompositeObject}
	 */
	static addTags(...tags) {
		for (const tag of tags)
			this.addTag(tag)
		return this
	}
	/**
	 * Removes given tag from object.
	 * @param {string} tag
	 * @this {CompositeObject}
	 */
	static removeTag(tag) {
		this.tags.delete(tag)
		return this
	}
	/**
	 * Removes given tags from object.
	 * @param  {...any} tags
	 * @this {CompositeObject}
	 */
	static removeTags(...tags) {
		for (const tag of tags)
			this.removeTag(tag)
		return this
	}
	/**
	 * Returns whether the object has the given tag.
	 * @param {string} tag
	 */
	static hasTag(tag) {
		return this.tags.has(tag)
	}
	/**
	 * Returns whether the object has all the given tags.
	 * @param {string} tag
	 */
	static hasTags(...tags) {
		for (const tag of tags)
			if (!this.hasTag(tag))
				return false
		return true
	}
}
export class CStrings extends Component {
	/**
	 * @desc A map containing global strings in the module itself.
	 * @type {Map<string, string>}
	 */
	static __globalStrings = new Map()
	/**
	 * @desc A map containing global replacers in the module itself.
	 * Placeholders should be preceded by the character `$`; `\$` will be ignored.
	 *
	 * Capitalized placeholders will capitalize the string returned by the replacer.
	 * Uppercase placeholders will capitalize all words in the string returned by the replacer.
	 * @type {Map<string, (this: CompositeObject) => string>}
	 */
	static __globalPlaceholders = new Map()
	/**
	 * @desc A map containing the object's strings.
	 * @type {Map<string, string | () => string>}
	 */
	static strings = new Map()
	/**
	 * @desc A map containing the object's placeholder strings and their replacement functions.
	 * Placeholders should be preceded by the character `$`; `\$` will be ignored.
	 *
	 * Capitalized placeholders will capitalize the string returned by the replacer.
	 * Uppercase placeholders will capitalize all words in the string returned by the replacer.
	 * @type {Map<string, (this: CompositeObject) => string>}
	 */
	static placeholders = new Map()

	/**
	 * @param {string} key
	 * @param {string | () => string} string
	 * @this {CompositeObject}
	 */
	static setString(key, string) {
		this.strings.set(key, string)
		return this
	}
	/**
	 * @param {...Array<string, string>} pairs
	 * @this {CompositeObject}
	 */
	static setStrings(...pairs) {
		for (const pair of pairs)
			this.setString(...pair)
		return this
	}
	/**
	 * @param {string} key Key to the string.
	 * @param {boolean} defaultFallback Whether the default string of same key should be returned, if it exists. Defaults to `false`.
	 */
	static getString(key, defaultFallback=false) {
		let found = this.strings.get(key)?? ''
		if (found === '' && defaultFallback)
			found = Defaults.getString(key)?? ''
		if (typeof(found) === 'function')
			return found.apply(this)
		else
			return found
	}
	/**
	 * Register a string shorthand to the object itself. The string can then be accessed as `object.$<shorthand>`.
	 * @param {string} shorthand The name of the shorthand. Lowercase alphanumeric and underscore only.
	 * @param {string} key The key to the string it should refer to. Defaults to the same as the shorthand.
	 * @param {boolean} registerPlaceholder Whether the shorthand should be registered as a replacer as well.
	 */
	static registerShorthand(shorthand, key=shorthand, registerPlaceholder=true) {
		if (shorthand.match(/[^\w]/))
			throw new Error(`Trying to register string shorthand '${shorthand}', which contains non-word characters.`)
		if (this['$' + shorthand])
			delete this['$' + shorthand]
		Object.defineProperty(this, `$${shorthand}`, {
			get() { return this.getString(key) },
			set(v) { this.setString(key, v) },
			configurable: true
		})
		if (registerPlaceholder)
			this.registerPlaceholder(shorthand, (object) => object.getString(key))
		return this
	}
	/**
	 * Returns a copy of the string with all placeholders replaced.
	 * Placeholders should be preceded by the character `$`; `\$` will be ignored.
	 *
	 * Capitalized placeholders will capitalize the string returned by the replacer.
	 * Uppercase placeholders will capitalize all words in the string returned by the replacer.
	 * @param {string} string
	 * @param {boolean} recursive Whether to parse placeholders _in_ placeholders. Defaults to `true`.
	 */
	static parseString(string, recursive=true) {
		let parsed = string.slice()
		let objectPHs = Array.from(this.placeholders.keys())
		let foundPHs = Array.from(parsed.matchAll(/(?<!\\)\$([\w]+)/g)).map(m => m[1])
			.filter(p => objectPHs.includes(p.toLowerCase()))
		while (foundPHs.length > 0) {
			for (const found of foundPHs)
				if (objectPHs.includes(found.toLowerCase()))
					parsed = parsed.replace(new RegExp(`\\$${found}`),
						found[0] === found[0].toUpperCase()?
						(found === found.toUpperCase()?
							capitalize(this.placeholders.get(found.toLowerCase())(this), true)
							: capitalize(this.placeholders.get(found.toLowerCase())(this)))
						: this.placeholders.get(found.toLowerCase())(this)
					)
			if (recursive)
				foundPHs = Array.from(parsed.matchAll(/(?<!\\)\$([\w]+)/g)).map(m => m[1])
					.filter(p => objectPHs.includes(p.toLowerCase()))
			else break
		}
		return parsed
	}
	/**
	 * Registers a placeholder and replacer function for parsing strings.
	 * Placeholders should be preceded by the character `$`; `\$` will be ignored.
	 *
	 * Capitalized placeholders will capitalize the string returned by the replacer.
	 * Uppercase placeholders will capitalize all words in the string returned by the replacer.
	 * @param {string} placeholder Placeholder to be sought and replaced.
	 * @param {(object: CompositeObject) => string} replacer Function that will return the replacement string.
	 */
	static registerPlaceholder(placeholder, replacer) {
		if (placeholder.match(/\s/))
			throw new Error(`Trying to register string placeholder '${placeholder}', which contains whitespace characters.`)
		this.placeholders.set(placeholder, replacer)
	}
}
export class CVariables extends Component {
	/**
	 * @desc A map containing global variables in the module itself.
	 * @type {Map<string, any>}
	 */
	static __globalVars = new Map()
	/**
	 * @desc A map containing variables pertaining to the object's dynamic functionality.
	 * @type {Map<string, any>}
	 */
	static vars = new Map()

	/**
	 * Registers a new variable in the object.
	 * @param {string} name
	 * @param {any} initialValue
	 * @this {CompositeObject}
	 */
	static registerVariable(name, initialValue=undefined) {
		this.vars.set(name, {value: initialValue, initial: initialValue})
		return this
	}
	/**
	 * Sets the value of a variable in the object.
	 * @param {string} name
	 * @param {any} value
	 * @this {CompositeObject}
	 */
	static setVar(name, value) {
		if (!this.vars.has(name))
			return new OperationFail('setVar', this, "notFound", `Trying to set variable '${name}' on '${this}', but it isn't registered`)
		this.vars.get(name).value = value
		return this
	}
	/**
	 * Returns the value of a variable in the object. Returns `null` if variable does not exist in the object.
	 * @param {string} name
	 * @returns {any | null}
	 */
	static getVar(name) {
		return this.vars.has(name)?
			this.vars.get(name).value
			: new OperationFail('getVar', this, "notFound", `Trying to get variable '${name}' on '${this}', but it isn't registered`)
	}
	/**
	 * Resets the variable to its registered initial value. Returns that value.
	 * @param {string} name
	 */
	static resetVar(name) {
		if (!this.vars.has(name))
			return new OperationFail('resetVar', this, "notFound", `Trying to reset variable '${name}' on '${this}', but it isn't registered`)
		const variable = this.vars.get(name)
		variable.value = variable.initial
		return variable.value
	}
	/**
	 * Change the value of a variable in the object by performing an operation on current value. Returns the updated value.
	 * @param {string} name
	 * @param {(value: any) => any} operation
	 * @param {any} valueIfUnset
	 * @returns {any}
	 */
	static alterVar(name, operation, valueIfUnset=0) {
		if (!this.vars.has(name))
			return new OperationFail('alterVar', this, "notFound", `Trying to alter variable '${name}' on '${this}', but it isn't registered`)
		const variable = this.vars.get(name)
		return variable.value = operation(variable.value === undefined? valueIfUnset : variable.value)
	}
}
export class CDescriptors extends Component {
	/**
	 * @desc Array of components this component depends on to function.
	 * @type {Map<string, any>}
	 */
	static dependencies = [CStrings]

	/**
	 * Sets the object's descriptors.
	 * @param {string} article Appropriate article for the object (i.e. a/an/the).
	 * @param {string} singular Appropriate singular for the object.
	 * @param {string} description Description for the object. Defaults to "article singular".
	 * @param {DescriptorProps} props Extra properties. `"they"` will always replace the pronoun if the object has CCountable and `count > 1`.
	 * @this {CompositeObject}
	 */
	static setDescriptors(article, singular, description=article+' '+singular, props={plural:singular+'s', pronoun:'it'}) {
		this.setString('an', article)
		this.registerShorthand('an')
		this.setString('it', props.pronoun?? 'it')
		this.registerShorthand('it')
		this.setString('singular', singular)
		this.registerShorthand('singular')
		this.setString('plural', props.plural?? singular+'s')
		this.registerShorthand('plural')
		this.setString('description', description)
		this.registerShorthand('description')
		this.setString('name', function() { return (this.hasComponents(CCountable) && this.count > 1)?
			`${this.count} ${this.$plural?? ''}`
			: `${this.$an?? ''} ${this.$singular?? ''}`
		})
		this.registerShorthand('name', 'name', false)
		this.registerPlaceholder('name', function(object) { return object.getString('name') })
		this.setString('they', function() {return (this.hasComponents(CCountable) && this.count > 1)? 'they' : this.getString('it') })
		this.registerShorthand('they')
		return this
	}
}
export class CCountable extends Component {
	/**
	 * @desc Amount of items the object represents.
	 * @type {number}
	 */
	static c = 1

	static get count() { return this.c }
	static set count(v) {
		this.c = v
		if (v <= 0 && this.hasComponents(COwnable))
			this.owner?.removeItem(this)
		if (v < 0) {
			console.warn(`Item ${this} was set to negative value. Clamped to 0`)
			this.c = 0
		}
	}
	/**
	 * Splits some amount of the item off and returns it as a new instance.
	 * @param {number} quantity
	 * @return {CompositeObject}
	 */
	static split(quantity) {
		const newItem = this.clone()
		this.count -= quantity
		newItem.count = quantity
		if (this.hasComponents(COwnable))
			newItem.setOwner(undefined)
		return newItem
	}
}
export class CInteractable extends Component {
	/**
	 * @desc A set of Interaction instances.
	 * @type {Set<Interaction>}
	 */
	static interactions = new Set()

	static get interactions() { return new Set(this.interactions) }
	/**
	 * Adds the interaction to the object.
	 * @param {Interaction | string | number} interaction Interaction instance or its name or ID.
	 * @this {CompositeObject}
	 */
	static addInteraction(interaction) {
		// debugger
		if (typeof(interaction) === 'string' || typeof(interaction) === 'number') {
			interaction = Interaction.get(interaction)
			if (interaction === null)
				return new OperationFail('addInteraction', this, "notFound", `Trying to add interaction '${interaction}' to '${this}', but it doesn't exist.`)
		}
		const caller = (...args) => {
			this.interactions[`${interaction.name}Count`] += 1
			return interaction.fn.apply(this, ...args)
		}
		if (this.findInteraction(interaction.name, false))
			return this
		this.interactions.add(interaction)
		this.interactions[interaction.name] = caller
		this.interactions[`${interaction.name}Count`] = 0
		return this
	}
	/**
	 * Adds the interactions to the object.
	 * @param {Array<Interaction>} interactions
	 * @this {CompositeObject}
	 */
	static addInteractions(...interactions) {
		for (const interaction of interactions)
			this.addInteraction(interaction)
		return this
	}
	/**
	 * Removes the interaction from the object.
	 * @param {Interaction | string | number} interaction Interaction instance or its name or ID.
	 * @this {CompositeObject}
	 */
	static removeInteraction(interaction) {
		if (typeof(interaction) === 'string' || typeof(interaction) === 'number') {
			interaction = this.findInteraction(interaction, false)
			if (interaction instanceof OperationFail)
				return interaction
		}
		this.interactions.delete(interaction)
		delete this.interactions[interaction.name]
		delete this.interactions[`${interaction.name}Count`]
	}
	/**
	 * Removes the interactions from the object.
	 * @param {Array<Interaction>} interactions
	 * @this {CompositeObject}
	 */
	static removeInteractions(...interactions) {
		for (const interaction of interactions)
			this.removeInteraction(interaction)
		return this
	}
	/**
	 * Gets the interaction by name or ID. Returns it if found, false if not found. Calls the interaction if `call == true`.
	 * @param {string | number} identifier
	 * @param {boolean} call
	 * @return {Interaction | null}
	 */
	static findInteraction(identifier, call=true, ...args) {
		for (const interaction of this.interactions.values())
			if (interaction.name === identifier || interaction.id === identifier) {
				if (call)
					interaction.callFrom(this, ...args)
				return interaction
			}
		return null
	}
	/**
	 * Finds the first matching Interaction. Returns it if found, false if not found. Calls the interaction if `call == true`.
	 * @param {string} input
	 * @param {boolean} call
	 * @return {Interaction | null}
	 */
	static matchInteraction(input, call=true, ...args) {
		const matches = []
		for (const interaction of this.interactions.values())
			if (interaction.matchAgainst(input)) {
				matches.push([interaction.matchAgainst(input), interaction])
			}
		matches.sort((a, b) => b[0][0].length - a[0][0].length)
		if (matches.length === 0)
			return null
		if (call)
			matches[0][1].callFrom(this, ...args)
		return matches[0][1]
	}
}
export class CInventory extends Component {
	static dependencies = [CStrings]
	static inventory = []

	static __delete(object) {
		for (const obj of object.inventory)
			obj.delete()
	}

	/**
	 * Gives an item to the object's inventory.
	 * @param {CompositeObject} item
	 * @param {number} quantity
	 * @this {CompositeObject}
	 */
	static giveItem(item, quantity=undefined) {
		if (quantity <= 0)
			return new OperationFail('giveItem', item, 'valueError', `Trying to give zero or negative quantity of ${item} to ${this}`)
		if (!item.hasComponents(COwnable))
			return new OperationFail('giveItem', item, 'missingComponent', `Trying to give item ${item}, which does not have the COwnable component, to ${this}`)
		if (item.owner === this)
			return new OperationFail('giveItem', item, 'redundantOperation', `Trying to give item ${item} to its own owner ${this}`)
		//* Item is countable
		if (item.hasComponents(CCountable)) {
			const inInventory = this.findByID(item.id)
			//* This already has an instance of item in its inventory
			if (inInventory) {
				//* Item already has an owner
				if (item.owner)
					inInventory.count += Math.min(quantity?? item.count, item.count)
				//* Item does not have an owner
				else
					inInventory.count += quantity?? item.count
				item.count -= Math.min(quantity?? item.count, item.count)
			}
			//* This does not have an instance of item in its inventory
			else
				//* Item already has an owner
				if (item.owner) {
					const newItem = item.split(Math.min(quantity?? item.count, item.count))
					this.inventory.push(newItem)
					newItem.setOwner(this)
				}
				//* Item does not have an owner
				else {
					this.inventory.push(item)
					item.setOwner(this)
						.count = quantity?? item.count
				}
		}
		//* Item is not countable
		else {
			this.inventory.push(item)
			item.setOwner(this)
		}
		return this
	}
	/**
	 * Takes an item from the object's inventory and returns it, if present, or false.
	 * @param {CompositeObject} item
	 * @param {number} quantity
	 * @this {CompositeObject}
	 */
	static takeItem(item, quantity=undefined) {
		if (quantity <= 0)
			return new OperationFail('takeItem', item, 'valueError', `Trying to take zero or negative quantity of ${item} to ${this}`)
		if (!item.hasComponents(COwnable))
			return new OperationFail('takeItem', item, 'missingComponent', `Trying to take item ${item}, which is not an OwnableItem, from ${this}`)
		if (!this.findByID(item.id))
			return new OperationFail('takeItem', item, 'notFound', `Trying to take item ${item}, which is not owned by ${this}`)
		//* Item is countable
		if (item.hasComponents(CCountable))
			return item.split(quantity?? item.count)
		//* Item is not countable
		else {
			this.removeItem(item)
			return item
		}
	}
	/**
	 * Removes the item from the object's inventory and returns it, if present, or false, if not present.
	 * @param {CompositeObject} item
	 */
	static removeItem(item) {
		if (!this.findByID(item.id))
			return new OperationFail('takeItem', item, 'notFound', `Trying to remove item ${item}, which is not owned by ${this}`)
		this.inventory.splice(this.inventory.indexOf(item), 1)
		if (item.hasComponents(COwnable))
			item.setOwner(undefined)
		return item
	}
	/**
	 * Finds and returns an item matching the ID from the object's inventory, if present, or false.
	 * @param {number | string} id
	 * @return {CompositeObject | false}
	 */
	static findByID(id) {
		if (typeof(id) === 'number')
			return this.inventory.find(i => i.id === id)?? false
		if (typeof(id) === 'string')
			return this.inventory.find(i => i.identifier === id)?? false
	}
	/**
	 * Finds and returns an item matching the input from the object's inventory, if present, or false.
	 * @param {number | string} id
	 * @return {CompositeObject | false}
	 */
	static findByMatch(input) {
		return this.inventory.find(i => i.hasComponents(CMatch) && i.matchAgainst(input))?? false
	}
	/**
	 * Sets inventory strings.
	 *
	 * If using the default `look` interaction, it's worth including the `description` in `inventory`, as the interaction uses the `inventory` string rather than `description`.
	 * @param {string} inventory Template string displaying the inventory.
	 * @param {string} list_item String describing each item in the inventory list.
	 */
	static setInventoryStrings(inventory, list_item) {
		this.setString('inventory', inventory)
		this.setString('list_item', list_item)
	}
}
export class COwnable extends Component {
	static dependencies = [CInteractable]
	/**
	 * @desc What this object is owned by.
	 * @type {CompositeObject}
	 */
	static owner

	static __postAddition(object) {
		object.addInteractions(
			Interaction.get('take'),
			Interaction.get('drop')
		)
	}
	static __delete(object) {
		object.owner.removeItem(object)
	}


	/**
	 * Set this object's owner.
	 * @param {CompositeObject} newOwner
	 * @this {CompositeObject}
	 */
	static setOwner(newOwner) {
		this.owner = newOwner
		return this
	}
}
export class CLocation extends Component {
	/**
	 * @desc The area where the object is located.
	 * @type {Area}
	 */
	static location

	static get location() {
		if (this.location instanceof CompositeObject && this.location.hasComponents(CLocation))
			return this.location.location
		else
			return this.location
	}
	/**
	 * @param {Area | CompositeObject} v
	 */
	static set location(v) { this.location = v }

	/**
	 * Moves the object to a given area.
	 * @param {Area} area
	 * @this {CompositeObject}
	 */
	static moveTo(area) {
		if (this.hasComponents(COwnable) && this.owner instanceof Area && this.owner === this.location)
			area.giveItem(this)
		this.location = area
		if (this.hasComponents(CInventory))
			for (const object of this.inventory)
				if (object.hasComponents(CLocation))
					object.moveTo(area)
		return this
	}
}
export class CStats extends Component {
	/**
	 * @desc Map of stats the object has.
	 * @type {Map<string, Stat>}
	 */
	static stats = new Map()

	/**
	 * Register a new stat to the object.
	 * @param {Stat} stat
	 * @this {CompositeObject}
	 */
	static registerStat(stat) {
		if (!(stat instanceof Stat))
			return new OperationFail('registerStat', this, "valueError", `Trying to add non-Stat value '${stat}' to ${this}`)
		this.stats.set(stat.name, stat)
		return this
	}
	/**
	 * Calculate a given stat in the object.
	 * @param {string} name
	 * @param {boolean} round Whether the value should be rounded according to the Stat's properties.
	 * @param {boolean} includeEquipment If set to true, the `value`, `add` and `mult` values of both this object and any equipment will be summed before calculation
	 */
	static calculateStat(name, round=true, includeEquipment=true) {
		if (includeEquipment && this.hasComponents(CEquipmentSlots)) {
			const temporary = this.stats.get(name).copy()
			for (const equipment of this.slots.values()) {
				const equipmentStat = equipment.stats.get(name)
				if (!equipmentStat)
					continue
				temporary.value += equipmentStat.value
				temporary.add += equipmentStat.add
				temporary.mult += equipmentStat.mult
			}
			return temporary.calculate(round)
		}
		else
			return this.stats.get(name).calculate(round)
	}
}
export class CEquipmentSlots extends Component {
	/**
	 * @desc Map of equipment slots available.
	 * @type {Map<string, CompositeObject | undefined>}
	 */
	static slots = new Map()

	/**
	 * Add an equipment slot to the object.
	 * @param {string} name
	 */
	static addSlot(name) {
		this.slots.set(name, false)
		this.slots[name] = false
		return this
	}
	/**
	 * Remove an equipment slot from the object.
	 * @param {string} name
	 */
	static removeSlot(name) {
		this.slots.delete(name)
		delete this.slots[name]
		return this
	}
	/**
	 * @param {string} name
	 */
	static getSlot(name) {
		return this.slots.get(name)
	}
	/**
	 * Returns whether the slot is currently occupied by an object.
	 * @param {string} name
	 */
	static isSlotTaken(name) {
		return !!this.slots.get(name)
	}
	/**
	 * Equip an item.
	 * @param {CompositeObject} item
	 * @param {string} slot If falsy, will equip the item in the first available empty equippable slot, or the first equippable slot, unequipping what's currently there.
	 */
	static equipItem(item, slot=undefined) {
		if (!item.hasComponents(CEquippable))
			return new OperationFail('equipItem', item, 'missingComponent', `Trying to equip '${item}', which is not an CEquippable item, on ${this}`)
		if (slot) {
			if (!this.slots.has(slot))
				return new OperationFail('equipItem', item, '', `Trying to equip '${item}' on slot '${slot}, but '${this}' has no such slot.`)
			if (this.isSlotTaken(slot))
				this.unequipItem(this.slots.get(slot))
			this.slots.set(slot, item)
			return this
		}
		let firstEmptySlot = false
		let prioritySlot = false
		for (const slot of item.equippableSlots) {
			//? Slot not present
			if (!this.slots.has(slot))
				continue
			//? First possible slot found
			else if (!prioritySlot)
				prioritySlot = slot
			//? First empty slot found
			else if (!this.isSlotTaken(slot))
				firstEmptySlot = slot
		}
		if (!firstEmptySlot)
			if (!prioritySlot)
				return new OperationFail('equipItem', item, '', `Trying to equip '${item}', but '${this}' has no usable slots.`)
			else if (this.isSlotTaken(prioritySlot))
					this.unequipItem(this.slots.get(prioritySlot))
		this.slots.set(firstEmptySlot || prioritySlot, item)
		return this
	}
	/**
	 * Unequip an item.
	 * @param {CompositeObject} item
	 */
	static unequipItem(item) {
		for (const [slot, equipped] of this.slots.entries())
			if (equipped === item) {
				this.slots.set(slot, undefined)
				return this
			}
		return new OperationFail('unequipItem', item, 'notFound', `Trying to equip '${item}', but it was not found or is not equipped.`)
	}
	/**
	 * Vacate an equipment slot.
	 * @param {string} slot
	 */
	static unequipSlot(slot) {
		if (!this.slots.has(slot))
			return new OperationFail('unequipSlot', this, 'notFound', `Trying to unequip '${slot}' on '${this}', but it has no such slot.`)
		this.slots.set(slot, undefined)
		return this
	}
}
export class CEquippable extends Component {
	static dependencies = [CDescriptors, COwnable, CStats]
	/**
	 * @desc Set of equipment slots the item can be equipped to/on.
	 * @type {Set<string>}
	 */
	static equippableSlots = new Set()

	static __postAddition(object) {
		object.addInteractions(
			Interaction.get('equip'),
			Interaction.get('unequip'),
		)
	}

	/**
	 * @desc Whether the item is equipped on its owner.
	 * @type {boolean}
	 */
	static get isEquipped() {
		if (!this.owner || !this.owner.hasComponents(CEquipmentSlots))
			return false
		return !!Array.from(this.owner.slots.values()).find(s => s === this)
	}
	/**
	 * @desc Slot the item is equipped to/on.
	 * @type {string | undefined}
	 */
	static get equippedSlot() {
		if (!this.owner || !this.owner.hasComponents(CEquipmentSlots))
			return undefined
		for (const [slot, item] of this.owner.slots.entries())
			if (item === this)
				return slot
		return undefined
	}
	/**
	 * Add slots the item can be equipped to/on.
	 * @param  {...string} slots
	 */
	static addEquippableSlots(...slots) {
		for (const slot of slots)
			this.equippableSlots.add(slot)
		return this
	}
	/**
	 * Remove slots the item can be equipped to/on.
	 * @param  {...string} slots
	 */
	static removeEquippableSlots(...slots) {
		for (const slot of slots)
			this.equippableSlots.delete(slot)
	}
}
export class CStatusEffects extends Component {
	/**
	 * @desc Map of StatusEffects applied to the object.
	 * @type {Map<string, StatusEffect>}
	 */
	static effects = new Map()

	/**
	 * Apply a StatusEffect to the object.
	 * @param {StatusEffect} effect
	 * @param {behavior: 'replace'|'refresh'|'addturns'|'stack'|'refresh+stack'|'addturns+stack'|'ignore'} behavior
	 */
	static applyStatusEffect(effect, behavior='refresh') {
		if (!(effect instanceof StatusEffect)) {
			new OperationFail('applyStatusEffect', this, "valueError", `Trying to apply non-StatusEffect object to ${this}`)
			return this
		}
		const existing = this.effects.get(effect.name)
		if (existing) {
			const operations = (options.behavior?? 'refresh').split('+')
			for (const op of operations)
				switch (op) {
					case 'replace':
						this.removeStatusEffect(existing)
						this.effects.set(effect.name, effect)
						break
					case 'refresh':
						existing.turns = Math.max(existing.turns, effect.turns)
						break
					case 'addturns':
						existing.turns += effect.turns
						break
					case 'stack':
						existing.stacks += effects.stacks
						break
					case 'ignore':
						break
				}
		}
		else
			this.effects.set(effect.name, effect)
	}
	/**
	 * Removes the named StatusEffect from the object, if existent.
	 * @param {string} effectName
	 */
	static removeStatusEffect(effectName) {
		this.effects.delete(effectName)
		return this
	}
}
export class CActions extends Component {
	/**
	 * @desc Map of actions the object can perform.
	 * @type {Map<string, Action>}
	 */
	static actions = new Map()

	/**
	 * Add an action to the object.
	 * @param {string} name
	 * @param {Action} fn
	 */
	static addAction(name, fn) {
		if (this.actions.has(name))
			return new OperationFail('addAction', this, "valueError", `Trying to add action '${name}' to ${this}, but it already has an action with that name`)
		this.actions.set(name, fn)
		return this
	}
	/**
	 * Removes the action associated with the given name, if existent.
	 * @param {string} name
	 */
	static removeAction(name) {
		this.actions.delete(name)
		return this
	}
	/**
	 * Make the object perform the action associated with the given name, if existent.
	 * @param {string} name
	 * @param  {...any} args
	 */
	static doAction(name, ...args) {
		if (!this.actions.has(name))
			return new OperationFail('doAction', this, "notFound", `Tried to perform non-existent action '${name}' on ${this}`)
		this.actions.get(name)(this, ...args)
	}
}
//# MARK: Modules
//# MARK: Game
export class Game {
	static #parseFunction
	static #outputFunction = console.log
	static player
	static currentInput
	static lastInput

	static get here() { return player.location }

	/**
	 * Set the function to be used as the game's output.
	 * @param {(string: string) => any} fn
	 */
	static setOutputFunction(fn) {
		this.#outputFunction = fn
	}
	/**
	 * Set a custom function to be used for parsing.
	 * @param {(input: string) => any} fn
	 */
	static setParsingFunction(fn) {
		this.#parseFunction = fn
	}
	static setPlayer(player) {
		this.player = player
	}
	static parse(input) {
		this.lastInput = this.currentInput
		this.currentInput = input
		if (this.#parseFunction)
			this.#parseFunction(input)
	}
	static out(string) {
		this.#outputFunction(string)
	}
}
for (const component of [CStrings, CVariables, CInteractable])
	component.addTo(Game)

//! MARK: Defaults
const Defaults = {}
for (const component of [CStrings, CVariables, CInteractable])
	component.addTo(Defaults)

//# Default Interactions
Defaults.addInteractions(
	new Interaction('inventory',
		'Check your inventory.',
		/^((?:(?:take\s+a\s+)?look(?:\s+at)?|inspect|investigate)(?!\s+(?:at|surroundings|around|here|about)))/i,
		function() { Game.out(this.$inventory) }
	),
	new Interaction('look',
		'Inspect an object more closely.',
		/^((?:(?:take\s+a\s+)?look(?:\s+at)?|inspect|investigate)(?!\s+(?:at|surroundings|around|here|about)))/i,
		function() {
			if (this.hasComponents(CDescriptors))
				Game.out(this.$description)
			else
				new OperationFail('interaction_look', this, "missingComponent", `${this} does not have the component CDescriptors`)
		}
	),
	new Interaction('take',
		'Take an item into your inventory.',
		/^((?:take|pick\s+up))/i,
		function(quantity=undefined) { Game.player.giveItem(this, quantity) }
	),
	new Interaction('drop',
		'Drop an item from your inventory.',
		/^(take|pick\s+up)/i,
		function(quantity=undefined) {
			if (this.hasComponents(CLocation))
				Game.player.takeItem(this, quantity).moveTo(Game.here)
			else
				new OperationFail('interaction_drop', this, "missingComponent", `${this} does not have the component CLocation`)
		}
	),
	new Interaction('equip',
		'Equip an item from your inventory.',
		/^((?<!un)equip)/i,
		function(slot=undefined) { Game.player.equipItem(this, slot) }
	),
	new Interaction('unequip',
		'Unequip an item from your inventory.',
		/^(unequip)/i,
		function() { Game.player.equipItem(this, slot) }
	),
	new Interaction('unequip slot',
		'Unequip a slot in your inventory.',
		/^(unequip)/i,
		function(slot=undefined) { Game.player.equipItem(this, slot) }
	),
)
Defaults.setStrings([])

//# Default Synergies
Synergy.register([CStrings, CCountable], function() { this.registerPlaceholder('count', (object) => `${object.count}`) })
Synergy.register([CStrings, CLocation], function() { this.registerPlaceholder('location', (object) => object.area.$name) })
Synergy.register([CDescriptors, CInteractable], function() { this.addInteraction(Interaction.get('look')) })
Synergy.register([CInventory, CStrings], function() {
	this.setString('inventory', `$description Searching it, you find $list.`)
	this.registerShorthand('inventory')
	this.setString('list_item', `$name`)
	this.registerShorthand('list_item')
	this.registerPlaceholder('list', function(object) { return arrayToList(object.inventory.map(i => i.parseString(object.parseString('$list_item', false)))) || 'nothing' })
})
Synergy.register([CStrings, CDescriptors], function() { this.setDescriptors('an', 'object', 'An object with unset descriptors.') })

//! MARK: Helper functions
/**
 * @param {string[]} array
 */
function arrayToList(array) {
	return array.join(", ").replace(/, (.*)$/, " and $1")
}
function capitalize(string, all=false) {
	const pairs = Array.from(string.match(/\b[\w-]+\b/g))
		.map(e => [e, e[0].toUpperCase() + e.slice(1)])
	for (const [find, replace] of pairs) {
		string = string.replace(new RegExp(`\\b${find}\\b`), replace)
		if (!all)
			return string
	}
	return string
}

// const p = new CompositeObject({ identifier: 'charredpebble', components: [CDescriptors, CCountable, CInteractable, COwnable] })
// 	.setDescriptors('a', 'charred pebble', 'A smooth, rounded pebble, charred and blackened with layers of soot that now cling to it.')
// const o = new CompositeObject({ identifier: 'orb', components: [CDescriptors, CInteractable, COwnable] })
// 	.setDescriptors('the', 'Orb', 'An orb that compels you to ponder it.')
// const e1 = new CompositeObject({ identifier: 'entity1', components: [CDescriptors, CInventory, CInteractable] })
// 	.setDescriptors('a', 'you', 'A tall, handsome kitsune.', { pronoun: 'he' })
// const e2 = new CompositeObject({ identifier: 'entity2', components: [CInventory] })
// e1.giveItem(p.clone(), 10)
// e1.giveItem(o.clone(), 1)
// GGame.setPlayer(e1)

// const c = new CompositeObject({ identifier: 'chest', components: [CDescriptors, CInventory] })
// 	.setDescriptors('a', 'chest', 'A worn wooden container, held together with iron studs.')

// const a = new AArea('forest', {
// 	description: 'A dark, gloomy forest, with dry, gnarled trees with no leaves',
// 	introduction: 'You enter a dark, gloomy forest.',
// 	name: 'Dark Forest',
// })