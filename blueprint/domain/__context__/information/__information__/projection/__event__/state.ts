export type State = {
  // Define readonly state properties needed for apply() in addition to the event properties
  // In most cases, the state will be empty as the event properties are sufficient to update the information
  // But sometimes you need to load the currently stored information and perform a replace in appy()
}
