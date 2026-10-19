'use strict'

// Mirrors NODE_TYPES in navar-frontend/src/components/nodeEditor/editorConstants.js.
// The backend is the authority: a type that is not listed here is rejected.
const t = (group, flags = {}) => ({
	group,
	isPwdType: Boolean(flags.pwd),
	isFloorTransition: Boolean(flags.transition),
	isEmergencyType: Boolean(flags.emergency),
	// NavAR Complete Workflow 1.5: only staircase edges are flagged inaccessible.
	// Elevator, escalator and ramp edges are accessible.
	blocksAccessibleRoute: Boolean(flags.blocksAccessible),
})

const NODE_TYPES = {
	WALKWAY: t('Navigation'),
	JUNCTION: t('Navigation'),
	STORE_ENTRANCE: t('Navigation'),
	STALL: t('Navigation'),
	EXIT: t('Navigation'),
	STAIRS: t('Floor Transition', { transition: true, blocksAccessible: true }),
	ESCALATOR: t('Floor Transition', { transition: true }),
	ELEVATOR: t('Floor Transition', { transition: true, pwd: true }),
	RAMP: t('Floor Transition', { transition: true, pwd: true }),
	EMERGENCY_EXIT: t('Emergency', { emergency: true }),
	FIRE_EXTINGUISHER: t('Emergency', { emergency: true }),
	FIRE_HOSE: t('Emergency', { emergency: true }),
	FIRST_AID: t('Emergency', { emergency: true }),
	AED: t('Emergency', { emergency: true }),
	ASSEMBLY_AREA: t('Emergency', { emergency: true }),
	RESTROOM: t('Facilities'),
	MALE_RESTROOM: t('Facilities'),
	FEMALE_RESTROOM: t('Facilities'),
	PWD_RESTROOM: t('Facilities', { pwd: true }),
	NURSING_ROOM: t('Facilities', { pwd: true }),
	PRAYER_ROOM: t('Facilities'),
	LOCKER: t('Facilities'),
	LOST_AND_FOUND: t('Facilities'),
	INFO_DESK: t('Landmarks'),
	CUSTOMER_SERVICE: t('Landmarks'),
	SECURITY_DESK: t('Landmarks'),
	ATM: t('Landmarks'),
	FOOD_COURT: t('Landmarks'),
	PARKING_ENTRANCE: t('Landmarks'),
	CHARGING_STATION: t('Landmarks'),
	MALL_DIRECTORY: t('Landmarks'),
	WATER_FOUNTAIN: t('Landmarks'),
	SEATING_AREA: t('Landmarks'),
	OTHER: t('Other'),
}

const PATH_TYPES = ['normal', 'accessible', 'restricted']

// Walking-effort cost, in meters, of one floor change. Floor changes have no
// horizontal distance on the plan, so A* needs an explicit weight. Tunable.
const FLOOR_CHANGE_COST_M = { ELEVATOR: 8, ESCALATOR: 10, STAIRS: 12, RAMP: 20 }

module.exports = { NODE_TYPES, PATH_TYPES, FLOOR_CHANGE_COST_M }
