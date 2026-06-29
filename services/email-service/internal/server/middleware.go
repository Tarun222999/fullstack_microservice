package server

import "net/http"

func (s *Server) requireInternalAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get(InternalTokenHeader)
		if token == "" || token != s.config.InternalToken {
			writeError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}

		next(w, r)
	}
}
